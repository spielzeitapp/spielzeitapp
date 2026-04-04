/**
 * Supabase Edge Function: fällige notification_jobs (pg_cron).
 *
 * - Claim: claim_notification_job (nur pending/failed, send_at <= now)
 * - In-App: nur public.notifications + notification_dispatch_log (keine legacy messages)
 * - Duplikat-Schutz: notification_dispatch_log mit reminder_key = job:<job_id> (pro User/Event/Kanal eindeutig)
 * - Push: best-effort (kein Fehler bei fehlenden Subscriptions / VAPID)
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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
  send_at?: string | null;
};

function rowsFromRpcClaim(data: unknown): JobRow[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as JobRow[];
  return [data as JobRow];
}

type EventRow = {
  id: string;
  team_season_id: string | number | null;
  starts_at: string | null;
  meeting_at?: string | null;
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

function reminderReferenceIso(event: EventRow): string | null {
  return event.meeting_at ?? event.starts_at ?? null;
}

function reminderBody(label: "match" | "training" | "event", event: EventRow, teamName: string | null) {
  const at = isoDateTimeDeVienna(reminderReferenceIso(event));
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

function pushErrorHttpDetails(err: unknown): { statusCode?: number; status?: number; message: string; stack?: string } {
  const e = err as Record<string, unknown>;
  const statusCode = typeof e?.statusCode === "number" ? e.statusCode : undefined;
  const status = typeof e?.status === "number" ? e.status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  return { statusCode, status, message, stack };
}

function pushIsGoneError(err: unknown): boolean {
  const { statusCode, status } = pushErrorHttpDetails(err);
  const code = Number(statusCode ?? status);
  return code === 404 || code === 410;
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
  console.log("[notificationJobsWorker] status → sent", { jobId, sent_at: nowIso });
}

async function failJob(admin: SupabaseClient, job: JobRow, err: string) {
  const lastErr = String(err).slice(0, 2000);
  const { error } = await admin
    .from("notification_jobs")
    .update({
      status: "failed",
      last_error: lastErr,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "processing");
  if (error) {
    console.error("[send-reminders] failJob update failed", { jobId: job.id, error: error.message });
  } else {
    console.log("[notificationJobsWorker] status → failed", { jobId: job.id, last_error: lastErr });
  }
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

function dedupeRecipientUserIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

let vapidReady = false;
function ensureVapidOrThrow(): void {
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

async function sendPushesForUser(
  admin: SupabaseClient,
  jobId: string,
  userId: string,
  title: string,
  body: string,
  url: string,
): Promise<{ sent: number; removed: number; errors: string[] }> {
  const errors: string[] = [];
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .not("endpoint", "is", null);

  if (error) {
    console.error("[send-reminders] push_subscriptions select failed", { jobId, userId, error });
    errors.push(error.message);
    return { sent: 0, removed: 0, errors };
  }

  const rows = (subscriptions ?? []) as Array<{ endpoint?: string | null; p256dh?: string | null; auth?: string | null }>;
  if (rows.length === 0) {
    return { sent: 0, removed: 0, errors };
  }

  try {
    ensureVapidOrThrow();
  } catch (e) {
    console.warn("[send-reminders] VAPID not configured — push skipped", { jobId, userId, error: String(e) });
    errors.push(String(e));
    return { sent: 0, removed: 0, errors };
  }

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  let removed = 0;

  for (const row of rows) {
    const endpoint = row.endpoint ?? "";
    const p256dh = row.p256dh ?? "";
    const auth = row.auth ?? "";
    if (!endpoint || !p256dh || !auth) continue;

    try {
      await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, { TTL: 3600 });
      sent += 1;
    } catch (err) {
      const det = pushErrorHttpDetails(err);
      console.error("[send-reminders] push failed", { jobId, userId, http: det.statusCode ?? det.status, message: det.message });
      errors.push(det.message);
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

  return { sent, removed, errors };
}

async function processOneJob(
  admin: SupabaseClient,
  job: JobRow,
): Promise<{ ok: boolean; error?: string; inserted?: number; pushSent?: number }> {
  console.log("[send-reminders] processOneJob", { jobId: job.id, eventId: job.event_id, send_at: job.send_at });

  if (!job.event_id) {
    const err = "job has no event_id";
    await failJob(admin, job, err);
    return { ok: false, error: err };
  }

  const { reminderKey: payloadReminderKey } = parseJobPayload(job.payload);
  /** Unique-Key im Dispatch-Log = pro notification_job; verhindert doppelte notifications bei abweichenden Payload-Keys. */
  const dispatchLogReminderKey = `job:${job.id}`;

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

  if (((event as EventRow).status ?? "upcoming") !== "upcoming") {
    console.log("[send-reminders] skip: event not upcoming → completeJob", { jobId: job.id });
    await completeJob(admin, job.id);
    return { ok: true, inserted: 0, pushSent: 0 };
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
  const eventId = job.event_id;
  const deepLink = `/app/events/${eventId}`;

  let recipients = await fetchRecipientsForTeamSeason(admin, (event as EventRow).team_season_id!);
  recipients = dedupeRecipientUserIds(recipients);
  console.log("[send-reminders] recipients", { jobId: job.id, count: recipients.length });

  if (recipients.length === 0) {
    await completeJob(admin, job.id);
    return { ok: true, inserted: 0, pushSent: 0 };
  }

  let inserted = 0;
  let notificationInsertFailed = 0;
  let duplicateSkips = 0;
  let pushSent = 0;

  for (const userId of recipients) {
    try {
      const { data: logRow, error: logInsErr } = await admin
        .from("notification_dispatch_log")
        .insert({
          user_id: userId,
          event_id: eventId,
          reminder_key: dispatchLogReminderKey,
          channel: "in_app",
        })
        .select("id")
        .maybeSingle();

      if (logInsErr) {
        if (logInsErr.code === "23505") {
          duplicateSkips += 1;
          console.log("[send-reminders] skip duplicate (dispatch log unique)", {
            jobId: job.id,
            userId,
            dispatchLogReminderKey,
            payloadReminderKey,
          });
          continue;
        }
        throw logInsErr;
      }
      const logId = logRow?.id;
      if (!logId) continue;

      const nowIso = new Date().toISOString();
      const { error: insErr } = await admin.from("notifications").insert({
        team_id: job.team_id,
        user_id: userId,
        event_id: eventId,
        title,
        message: body,
        type: "auto",
        event_type: "reminder",
        read: false,
        link: deepLink,
        created_at: nowIso,
      });

      if (insErr) {
        await admin.from("notification_dispatch_log").delete().eq("id", logId);
        notificationInsertFailed += 1;
        console.error("[send-reminders] notifications insert failed", { jobId: job.id, userId, error: insErr.message });
        continue;
      }

      inserted += 1;

      const pushResult = await sendPushesForUser(admin, job.id, userId, title, body, deepLink);
      pushSent += pushResult.sent;
    } catch (err) {
      notificationInsertFailed += 1;
      console.error("[send-reminders] recipient loop error", { jobId: job.id, userId, err });
    }
  }

  const allInAppFailed =
    recipients.length > 0 &&
    notificationInsertFailed === recipients.length &&
    inserted === 0 &&
    duplicateSkips === 0;

  console.log("[send-reminders] summary", {
    jobId: job.id,
    inserted,
    duplicateSkips,
    notificationInsertFailed,
    pushSent,
    allInAppFailed,
  });

  if (allInAppFailed) {
    const err = `all in_app notification inserts failed (${notificationInsertFailed}/${recipients.length})`;
    await failJob(admin, job, err);
    return { ok: false, error: err, inserted, pushSent };
  }

  await completeJob(admin, job.id);
  return { ok: true, inserted, pushSent };
}

serve(async (req) => {
  try {
    const method = (req.method || "GET").toUpperCase();
    if (method !== "POST" && method !== "GET") {
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
    console.log("[send-reminders] due jobs select START", { nowIso });

    const { data: dueRows, error: dueErr } = await admin
      .from("notification_jobs")
      .select("id, send_at, event_id, status")
      .eq("status", "pending")
      .lte("send_at", nowIso)
      .order("send_at", { ascending: true })
      .limit(JOB_BATCH_LIMIT);

    if (dueErr) {
      console.error("[send-reminders] query due jobs failed", dueErr);
      return new Response(JSON.stringify({ ok: false, error: dueErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ids = (dueRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    console.log("[send-reminders] due jobs select DONE", { foundCount: ids.length, ids });

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

      const { data: claimedRows, error: claimErr } = await admin.rpc("claim_notification_job", {
        p_job_id: id,
      });

      if (claimErr) {
        console.error("[send-reminders] claim failed", { jobId: id, error: claimErr.message });
        failed += 1;
        continue;
      }

      const claimedRowsArr = rowsFromRpcClaim(claimedRows);
      const claimed = claimedRowsArr.length > 0 ? claimedRowsArr[0] : null;

      if (!claimed) {
        console.log("[send-reminders] claim skipped", { jobId: id });
        continue;
      }

      console.log("[send-reminders] status → processing", { jobId: claimed.id, attempt_count: claimed.attempt_count });
      processed += 1;

      try {
        const result = await processOneJob(admin, claimed);
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
        await failJob(admin, claimed, message);
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
