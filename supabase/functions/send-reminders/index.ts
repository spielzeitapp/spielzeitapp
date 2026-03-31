/**
 * Supabase Edge Function: fällige notification_jobs verarbeiten.
 * - idempotent per Claim pending -> processing
 * - In-App Benachrichtigung (notifications)
 * - Web Push (push_subscriptions)
 * - UTC intern, Textausgabe Europe/Vienna
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const REMINDER_LINK = "/app/termine";
const JOB_BATCH_LIMIT = 50;
const VIENNA_TZ = "Europe/Vienna";
const MEMBER_ROLES = ["trainer", "co_trainer", "head_coach", "parent", "player"];

type JobRow = {
  id: string;
  team_id: string | null;
  event_id: string | null;
  kind: string | null;
  payload: unknown;
  attempt_count?: number | null;
};

type EventRow = {
  id: string;
  team_season_id: string | number | null;
  starts_at: string | null;
  status?: string | null;
  kind?: string | null;
  type?: string | null;
  opponent?: string | null;
  notes?: string | null;
  location?: string | null;
};

type TeamRow = { id: string; name: string | null };

function parseJobPayload(raw: unknown): { reminderKey: string | null } {
  if (!raw || typeof raw !== "object") return { reminderKey: null };
  const p = raw as Record<string, unknown>;
  const reminderKey =
    typeof p.reminderKey === "string"
      ? p.reminderKey
      : typeof p.reminder_type === "string"
        ? p.reminder_type
        : null;
  return { reminderKey };
}

function isoDateTimeDeVienna(iso: string | null | undefined) {
  if (!iso) return "unbekannter Zeit";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unbekannter Zeit";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: VIENNA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function eventLabel(kind: string | null | undefined, event: EventRow): "match" | "training" | "event" {
  const k = (kind ?? event.kind ?? event.type ?? "").toLowerCase().trim();
  if (k === "match" || k === "game" || k === "spiel") return "match";
  if (k === "training") return "training";
  return "event";
}

function reminderTitle(label: "match" | "training" | "event") {
  if (label === "match") return "Spiel Erinnerung";
  if (label === "training") return "Training Erinnerung";
  return "Event Erinnerung";
}

function reminderBody(label: "match" | "training" | "event", event: EventRow, teamName: string | null) {
  const at = isoDateTimeDeVienna(event.starts_at);
  if (label === "training") {
    return `Erinnerung: Training heute um ${at} Uhr.`;
  }
  if (label === "match") {
    const vs = (event.opponent ?? "").trim();
    if (vs) return `Erinnerung: Spiel gegen ${vs} am ${at}.`;
    return `Erinnerung: Heute steht ein Spiel um ${at} an.`;
  }
  const title = (event.notes ?? "").split("·")[0]?.trim();
  if (title) return `Erinnerung: ${title} steht am ${at} an.`;
  if (teamName) return `Erinnerung: Ein Team-Event (${teamName}) steht am ${at} an.`;
  return `Erinnerung: Ein Event steht am ${at} an.`;
}

async function completeJob(admin: SupabaseClient, jobId: string) {
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("notification_jobs")
    .update({
      status: "sent",
      sent_at: nowIso,
      last_error: null,
      updated_at: nowIso,
    })
    .eq("id", jobId)
    .eq("status", "processing");
  if (error) {
    throw new Error(`completeJob failed: ${error.message}`);
  }
}

async function failJob(admin: SupabaseClient, job: JobRow, err: string) {
  const lastErr = String(err).slice(0, 2000);
  const attempt = (job.attempt_count ?? 0) + 1;
  const { error } = await admin
    .from("notification_jobs")
    .update({
      status: "failed",
      attempt_count: attempt,
      last_error: lastErr,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  if (error) {
    console.error("[send-reminders] failJob update failed", { jobId: job.id, error: error.message });
  }
}

async function notificationAlreadyDispatched(
  admin: SupabaseClient,
  userId: string,
  eventId: string,
  reminderKey: string,
) {
  // Kein maybeSingle: bei historischen Duplikaten würde >1 Zeile einen Fehler werfen und
  // die In-App-Zustellung komplett blockieren.
  const { data, error } = await admin
    .from("notification_dispatch_log")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .eq("reminder_key", reminderKey)
    .eq("channel", "in_app")
    .limit(1);
  if (error) throw error;
  return Boolean(data && data.length > 0);
}

async function fetchRecipientsForTeamSeason(admin: SupabaseClient, teamSeasonId: string | number) {
  const { data, error } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("team_season_id", teamSeasonId)
    .in("role", MEMBER_ROLES);
  if (error) throw error;
  const ids = (data ?? [])
    .map((r: { user_id?: string | null }) => r.user_id ?? null)
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const publicKey = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
  const privateKey = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  const subject = (Deno.env.get("VAPID_SUBJECT") ?? "").trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT müssen gesetzt sein.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
}

function pushIsGoneError(err: unknown) {
  const code = Number((err as { statusCode?: unknown })?.statusCode);
  const status = Number((err as { status?: unknown })?.status);
  return code === 404 || code === 410 || status === 404 || status === 410;
}

/**
 * Optional: Legacy-Zeile in `messages` (gleiches Muster wie api/send-reminders).
 * Fehler werden nur geloggt — Job und `notifications`-Pfad bleiben gültig.
 */
async function insertMessageOptional(
  admin: SupabaseClient,
  meta: {
    teamId: string | null;
    userId: string;
    eventId: string;
    title: string;
    body: string;
    link: string;
    reminderKey: string;
  },
): Promise<void> {
  if (!meta.teamId) return;
  try {
    const { error } = await admin.from("messages").insert({
      team_id: meta.teamId,
      user_id: meta.userId,
      title: meta.title,
      body: meta.body,
      content: `${meta.body}\n\n${meta.link}`,
      type: "team_push",
      read: false,
      link: meta.link,
      related_event_id: meta.eventId,
      event_id: meta.eventId,
      reminder_key: meta.reminderKey,
    });
    if (error) {
      console.warn("[send-reminders] optional messages.insert skipped", {
        userId: meta.userId,
        message: error.message,
        code: (error as { code?: string }).code,
      });
    } else {
      console.log("[send-reminders] messages row created (optional)", { userId: meta.userId, eventId: meta.eventId });
    }
  } catch (e) {
    console.warn("[send-reminders] optional messages.insert failed", { userId: meta.userId, error: e });
  }
}

async function sendPushesForUser(
  admin: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  url: string,
): Promise<{ sent: number; removed: number }> {
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .not("endpoint", "is", null);
  if (error) throw error;

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, removed: 0 };
  }

  ensureVapid();
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  let removed = 0;

  for (const row of subscriptions as Array<{ endpoint?: string | null; p256dh?: string | null; auth?: string | null }>) {
    const endpoint = row.endpoint ?? "";
    const p256dh = row.p256dh ?? "";
    const auth = row.auth ?? "";
    if (!endpoint || !p256dh || !auth) continue;

    try {
      await webpush.sendNotification(
        { endpoint, keys: { p256dh, auth } },
        payload,
        { TTL: 3600 },
      );
      sent += 1;
    } catch (err) {
      console.error("[send-reminders] push failed", { userId, endpoint, error: err });
      if (pushIsGoneError(err)) {
        const { error: delErr } = await admin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", endpoint);
        if (!delErr) removed += 1;
      }
    }
  }

  return { sent, removed };
}

async function processOneJob(
  admin: SupabaseClient,
  job: JobRow,
): Promise<{ ok: boolean; error?: string; inserted?: number; pushSent?: number; pushRemoved?: number }> {
  if (!job.event_id) {
    const err = "job has no event_id";
    await failJob(admin, job, err);
    return { ok: false, error: err };
  }

  const { reminderKey } = parseJobPayload(job.payload);
  const effectiveReminderKey = reminderKey ?? `job:${job.id}`;

  const { data: event, error: eventErr } = await admin
    .from("events")
    .select("id, team_season_id, starts_at, meeting_at, status, kind, type, opponent, notes, location")
    .eq("id", job.event_id)
    .maybeSingle();
  if (eventErr || !event) {
    const err = eventErr?.message ?? "event not found";
    await failJob(admin, job, err);
    return { ok: false, error: err };
  }
  if (!(event as EventRow).team_season_id) {
    const err = "event has no team_season_id";
    await failJob(admin, job, err);
    return { ok: false, error: err };
  }

  // Events, die nicht mehr upcoming sind, markieren wir als erledigt.
  if (((event as EventRow).status ?? "upcoming") !== "upcoming") {
    await completeJob(admin, job.id);
    return { ok: true, inserted: 0, pushSent: 0, pushRemoved: 0 };
  }

  let teamName: string | null = null;
  if (job.team_id) {
    const { data: team } = await admin
      .from("teams")
      .select("id, name")
      .eq("id", job.team_id)
      .maybeSingle();
    teamName = (team as TeamRow | null)?.name ?? null;
  }

  const label = eventLabel(job.kind, event as EventRow);
  const title = reminderTitle(label);
  const body = reminderBody(label, event as EventRow, teamName);
  const url = REMINDER_LINK.startsWith("/") ? REMINDER_LINK : `/${REMINDER_LINK}`;
  const recipients = await fetchRecipientsForTeamSeason(admin, (event as EventRow).team_season_id!);
  console.log("[send-reminders] job recipients resolved", {
    jobId: job.id,
    eventId: job.event_id,
    recipientCount: recipients.length,
  });
  if (recipients.length === 0) {
    await completeJob(admin, job.id);
    return { ok: true, inserted: 0, pushSent: 0, pushRemoved: 0 };
  }

  let inserted = 0;
  let pushSent = 0;
  let pushRemoved = 0;
  let recipientErrors = 0;

  for (const userId of recipients) {
    try {
      const exists = await notificationAlreadyDispatched(admin, userId, job.event_id, effectiveReminderKey);
      if (!exists) {
        const nowIso = new Date().toISOString();
        // notifications.type CHECK erlaubt nur 'manual' | 'auto'; Reminder-Semantik über event_type.
        const { error: insErr } = await admin.from("notifications").insert({
          team_id: job.team_id,
          user_id: userId,
          event_id: job.event_id,
          title,
          message: body,
          type: "auto",
          event_type: "reminder",
          read: false,
          link: url,
          created_at: nowIso,
        });
        if (insErr) {
          recipientErrors += 1;
          const errObj = insErr as { message?: string; code?: string; details?: string; hint?: string };
          console.error("[send-reminders] notification insert failed", {
            jobId: job.id,
            userId,
            error: errObj.message ?? String(insErr),
            code: errObj.code,
            details: errObj.details,
            hint: errObj.hint,
          });
        } else {
          inserted += 1;
          console.log("[send-reminders] notifications row created", {
            jobId: job.id,
            userId,
            eventId: job.event_id,
            reminderKey: effectiveReminderKey,
            kind: "reminder",
          });
          const { error: dispErr } = await admin.from("notification_dispatch_log").insert({
            user_id: userId,
            event_id: job.event_id,
            reminder_key: effectiveReminderKey,
            channel: "in_app",
          });
          if (dispErr) {
            const code = (dispErr as { code?: string }).code;
            if (code !== "23505") {
              console.error("[send-reminders] dispatch log insert failed", {
                userId,
                reminderKey: effectiveReminderKey,
                error: dispErr.message,
              });
            }
          }
          await insertMessageOptional(admin, {
            teamId: job.team_id,
            userId,
            eventId: job.event_id!,
            title,
            body,
            link: url,
            reminderKey: effectiveReminderKey,
          });
        }
      }

      // Push ist best-effort: einzelne fehlerhafte Subscriptions dürfen den Job nicht töten.
      const pushResult = await sendPushesForUser(admin, userId, title, body, url);
      pushSent += pushResult.sent;
      pushRemoved += pushResult.removed;
    } catch (err) {
      recipientErrors += 1;
      console.error("[send-reminders] sendPushesForUser failed", { userId, error: err });
    }
  }

  // Nur wenn ALLE Empfänger fehlschlagen, markieren wir den Job als failed.
  if (inserted === 0 && recipientErrors >= recipients.length) {
    const err = "all recipient deliveries failed";
    await failJob(admin, job, err);
    return { ok: false, error: err, inserted, pushSent, pushRemoved };
  }

  console.log("[send-reminders] job delivery summary", {
    jobId: job.id,
    eventId: job.event_id,
    usersInScope: recipients.length,
    notificationRowsInserted: inserted,
    pushNotificationsSent: pushSent,
    pushSubscriptionsRemoved: pushRemoved,
    recipientErrors,
  });

  await completeJob(admin, job.id);
  console.log("[send-reminders] job marked sent", { jobId: job.id, sentAt: new Date().toISOString() });
  return { ok: true, inserted, pushSent, pushRemoved };
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Supabase env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const nowIso = new Date().toISOString();
    const { data: dueRows, error: dueErr } = await admin
      .from("notification_jobs")
      .select("id, send_at, event_id, status")
      .eq("status", "pending")
      .lte("send_at", nowIso)
      .order("send_at", { ascending: true })
      .limit(JOB_BATCH_LIMIT);

    console.log("[reminderPipeline] due jobs query", {
      nowIso,
      pendingDueCount: (dueRows ?? []).length,
      sample: (dueRows ?? []).slice(0, 5),
    });

    if (dueErr) {
      console.error("[send-reminders] query due jobs failed", dueErr);
      return new Response(JSON.stringify({ ok: false, error: dueErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ids = (dueRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    console.log("[send-reminders] due jobs", { count: ids.length, ids });

    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, sent: 0, failed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const claimedInRun = new Set<string>();
    const errors: Array<{ jobId: string; error: string }> = [];
    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const id of ids) {
      if (claimedInRun.has(id)) continue;
      claimedInRun.add(id);

      const { data: claimed, error: claimErr } = await admin
        .from("notification_jobs")
        .update({
          status: "processing",
          updated_at: nowIso,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id, team_id, event_id, kind, payload, attempt_count")
        .maybeSingle();

      if (claimErr) {
        console.error("[send-reminders] claim failed", { jobId: id, error: claimErr.message });
        failed += 1;
        continue;
      }
      if (!claimed) continue; // wurde parallel bereits geclaimt

      processed += 1;
      const job = claimed as JobRow;

      try {
        const result = await processOneJob(admin, job);
        if (result.ok) {
          sent += 1;
        } else {
          failed += 1;
          if (result.error) errors.push({ jobId: id, error: result.error });
        }
        console.log("[send-reminders] job result", { jobId: id, result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[send-reminders] unhandled job error", { jobId: id, message, err });
        await failJob(admin, job, message);
        failed += 1;
        errors.push({ jobId: id, error: message });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        sent,
        failed,
        ...(errors.length ? { errors } : {}),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-reminders] fatal", { message, err });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
