/**
 * Supabase Edge Function: fällige notification_jobs (Push + messages).
 * Idempotent: Claim pending→processing; Dedupe über messages.reminder_key.
 * Fehler: attempt_count +1, last_error, status failed (kein Retry wie Vercel).
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const REMINDER_LINK = "/app/termine";
const JOB_BATCH_LIMIT = 50;

function formatTimeDe(iso: string | null | undefined) {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Vienna",
    });
  } catch {
    return "--:--";
  }
}

function titleForJobKind(kind: string | null | undefined) {
  if (kind === "match") return "⚽ Spiel-Erinnerung";
  if (kind === "training") return "🏃 Trainings-Erinnerung";
  return "📌 Erinnerung";
}

function buildReminderBody(
  kind: string | null | undefined,
  event: { starts_at?: string | null },
  reminderKey: string,
) {
  const t = formatTimeDe(event.starts_at ?? undefined);
  if (kind === "match") {
    if (reminderKey === "match_reminder_2") {
      return `Erinnerung: Treffpunkt bald (Spiel um ${t}).`;
    }
    return `Erinnerung: Spiel heute um ${t}`;
  }
  if (kind === "training") {
    return `Erinnerung: Training heute um ${t}`;
  }
  return `Erinnerung: Termin heute um ${t}`;
}

function parseJobPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const rk =
    typeof p.reminderKey === "string"
      ? p.reminderKey
      : typeof p.reminder_type === "string"
        ? p.reminder_type
        : null;
  if (typeof rk !== "string" || typeof p.offsetMinutes !== "number") return null;
  return {
    reminderKey: rk,
    offsetMinutes: p.offsetMinutes as number,
    notificationType: p.notificationType,
    baseTimeIso: typeof p.baseTimeIso === "string" ? p.baseTimeIso : "",
  };
}

async function fetchRecipientUserIdsForTeamSeason(
  admin: SupabaseClient,
  teamSeasonId: number,
) {
  const { data: members, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("team_season_id", teamSeasonId)
    .in("role", ["parent", "player"]);
  if (error) throw error;
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  return [...new Set(ids.filter(Boolean))];
}

async function fetchPlayerIdsForUserInTeamSeason(
  admin: SupabaseClient,
  userId: string,
  teamSeasonId: number,
) {
  const { data: players, error: pErr } = await admin
    .from("players")
    .select("id")
    .eq("team_season_id", teamSeasonId)
    .eq("is_active", true);
  if (pErr) throw pErr;
  const rosterIds = new Set((players ?? []).map((p: { id: string }) => p.id));

  const { data: g, error: gErr } = await admin
    .from("player_guardians")
    .select("player_id")
    .eq("user_id", userId);
  if (gErr) throw gErr;
  const fromG = (g ?? [])
    .map((x: { player_id: string }) => x.player_id)
    .filter((id: string) => rosterIds.has(id));

  const { data: pu, error: puErr } = await admin
    .from("player_users")
    .select("player_id")
    .eq("user_id", userId);
  if (puErr) throw puErr;
  const fromPu = (pu ?? [])
    .map((x: { player_id: string }) => x.player_id)
    .filter((id: string) => rosterIds.has(id));

  return [...new Set([...fromG, ...fromPu])];
}

function hasAllPlayersAnswered(playerIds: string[], attMap: Map<string, string | null>) {
  if (playerIds.length === 0) return true;
  return playerIds.every((pid) => {
    const s = attMap.get(pid);
    return s === "yes" || s === "no";
  });
}

async function messageExists(
  admin: SupabaseClient,
  userId: string,
  eventId: string,
  reminderKey: string,
) {
  const { data: ex } = await admin
    .from("messages")
    .select("id")
    .eq("user_id", userId)
    .eq("related_event_id", eventId)
    .eq("type", "team_push")
    .eq("reminder_key", reminderKey)
    .maybeSingle();
  return Boolean(ex && (ex as { id?: string }).id);
}

async function completeJob(admin: SupabaseClient, jobId: string) {
  await admin
    .from("notification_jobs")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing");
}

/** Edge: bei Fehler direkt failed (Vergleich: Vercel nutzt Retry bis 3). */
async function failJobPermanent(
  admin: SupabaseClient,
  job: { id: string; attempt_count?: number | null },
  err: string,
) {
  const attempt = (job.attempt_count ?? 0) + 1;
  const lastErr = String(err).slice(0, 2000);
  await admin
    .from("notification_jobs")
    .update({
      status: "failed",
      attempt_count: attempt,
      last_error: lastErr,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
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

async function sendOnePush(
  subRow: { endpoint: string; p256dh: string; auth: string },
  title: string,
  body: string,
  url: string,
) {
  ensureVapid();
  const payload = JSON.stringify({ title, body, url });
  await webpush.sendNotification(
    {
      endpoint: subRow.endpoint,
      keys: { p256dh: subRow.p256dh, auth: subRow.auth },
    },
    payload,
    { TTL: 3600 },
  );
}

type JobRow = {
  id: string;
  team_id: string;
  event_id: string;
  kind: string | null;
  payload: unknown;
  attempt_count?: number | null;
};

async function processOneJob(
  admin: SupabaseClient,
  job: JobRow,
): Promise<{ ok: boolean; error?: string; inserted?: number; pushSent?: number; skipped?: string }> {
  const payload = parseJobPayload(job.payload);
  if (!payload) {
    const err = "invalid job payload";
    await failJobPermanent(admin, job, err);
    return { ok: false, error: err };
  }

  const reminderKey = payload.reminderKey;

  const { data: event, error: evErr } = await admin
    .from("events")
    .select("*")
    .eq("id", job.event_id)
    .maybeSingle();

  if (evErr || !event) {
    const err = evErr?.message ?? "event not found";
    await failJobPermanent(admin, job, err);
    return { ok: false, error: err };
  }

  const title = titleForJobKind(job.kind);
  const textBody = buildReminderBody(job.kind, event as { starts_at?: string }, reminderKey);
  const url = REMINDER_LINK.startsWith("/") ? REMINDER_LINK : `/${REMINDER_LINK}`;
  const contentWithLink = `${textBody}\n\n${url}`;

  if ((event.status ?? "upcoming") !== "upcoming") {
    await completeJob(admin, job.id);
    return { ok: true, skipped: "event_not_upcoming" };
  }

  const { data: attRows, error: attErr } = await admin
    .from("event_attendance")
    .select("player_id, status")
    .eq("event_id", job.event_id);
  if (attErr) {
    await failJobPermanent(admin, job, attErr.message);
    return { ok: false, error: attErr.message };
  }

  const attMap = new Map<string, string | null>();
  for (const row of attRows ?? []) {
    const r = row as { player_id: string; status: string | null };
    attMap.set(r.player_id, r.status);
  }

  let userIds: string[];
  try {
    userIds = await fetchRecipientUserIdsForTeamSeason(
      admin,
      (event as { team_season_id: number }).team_season_id,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failJobPermanent(admin, job, msg);
    return { ok: false, error: msg };
  }

  const recipients: string[] = [];
  const teamSeasonId = (event as { team_season_id: number }).team_season_id;
  for (const userId of userIds) {
    let playerIds: string[];
    try {
      playerIds = await fetchPlayerIdsForUserInTeamSeason(admin, userId, teamSeasonId);
    } catch {
      continue;
    }
    if (playerIds.length === 0) continue;
    if (hasAllPlayersAnswered(playerIds, attMap)) continue;
    recipients.push(userId);
  }

  if (recipients.length === 0) {
    await completeJob(admin, job.id);
    return { ok: true, inserted: 0, pushSent: 0, skipped: "no_recipients" };
  }

  let inserted = 0;
  let pushSent = 0;

  for (const userId of recipients) {
    const exists = await messageExists(admin, userId, job.event_id, reminderKey);
    if (exists) continue;

    const { error: insErr } = await admin.from("messages").insert({
      team_id: job.team_id,
      user_id: userId,
      title,
      body: textBody,
      content: contentWithLink,
      type: "team_push",
      read: false,
      link: url,
      related_event_id: job.event_id,
      event_id: job.event_id,
      reminder_key: reminderKey,
      notification_kind:
        job.kind === "match" ? "match" : job.kind === "training" ? "training" : "event",
    });

    if (insErr) {
      throw new Error(insErr.message ?? String(insErr));
    }
    inserted += 1;

    const { data: sub } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId)
      .not("endpoint", "is", null)
      .maybeSingle();

    if (!sub || !sub.endpoint || !sub.p256dh || !sub.auth) continue;

    try {
      await sendOnePush(sub as { endpoint: string; p256dh: string; auth: string }, title, textBody, url);
      pushSent += 1;
    } catch (pe) {
      console.error(
        "[send-reminders] push failed",
        userId,
        pe instanceof Error ? pe.message : pe,
      );
    }
  }

  await completeJob(admin, job.id);
  return { ok: true, inserted, pushSent };
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Supabase env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const nowIso = new Date().toISOString();

    const { data: jobIds, error: qErr } = await admin
      .from("notification_jobs")
      .select("id")
      .eq("status", "pending")
      .lte("send_at", nowIso)
      .order("send_at", { ascending: true })
      .limit(JOB_BATCH_LIMIT);

    if (qErr) {
      console.error("SEND REMINDERS ERROR", qErr);
      return new Response(JSON.stringify({ ok: false, error: qErr.message ?? "query failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ids = (jobIds ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    console.log("due job ids count", ids.length, ids);

    let processed = 0;
    let sent = 0;
    let failed = 0;
    const errors: { jobId: string; error: string }[] = [];

    for (const id of ids) {
      const { data: claimed, error: claimErr } = await admin
        .from("notification_jobs")
        .update({
          status: "processing",
          updated_at: nowIso,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();

      if (claimErr) {
        console.error("[send-reminders] claim", id, claimErr.message);
        failed += 1;
        continue;
      }
      if (!claimed) continue;

      processed += 1;
      const job = claimed as JobRow;
      try {
        const r = await processOneJob(admin, job);
        if (r.ok) sent += 1;
        else failed += 1;
        if (r.error) errors.push({ jobId: id, error: r.error });
        console.log("[send-reminders] job result", id, r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("SEND REMINDERS ERROR job", id, msg, e instanceof Error ? e.stack : "");
        await failJobPermanent(admin, job, msg);
        failed += 1;
        errors.push({ jobId: id, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Reminder jobs processed",
        processed,
        sent,
        failed,
        ...(errors.length ? { errors } : {}),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("SEND REMINDERS ERROR", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
