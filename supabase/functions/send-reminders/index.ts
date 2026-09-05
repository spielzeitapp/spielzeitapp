import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
/**
 * Produktiv: `notification_jobs` → `notifications` + Web Push über `push_subscriptions`
 * (gleicher Stack wie `api/push/send-team.js` / Direkt-Push).
 * Edge Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (wie Backend).
 *
 * Hinweis: Nur einen Scheduler nutzen (Supabase-Cron auf diese Function **oder** Vercel-Cron auf
 * `/api/send-reminders`) — sonst doppelte Pushes.
 */
import webpush from "npm:web-push@3.6.7";

const JOB_BATCH_LIMIT = 50;
const VIENNA_TZ = "Europe/Vienna";

type JobRow = {
  id: string;
  team_id: string | null;
  event_id: string | null;
  kind?: string | null;
  payload: Record<string, unknown> | null;
};

type EventRow = {
  id: string;
  team_season_id: string;
  starts_at: string | null;
  meeting_at?: string | null;
  status?: string | null;
  opponent?: string | null;
  notes?: string | null;
  match_id?: string | null;
};

type SubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
};

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
  const privateKey = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  const subject = (Deno.env.get("VAPID_SUBJECT") ?? "").trim();
  if (!publicKey || !privateKey || !subject) {
    console.warn(
      "[send-reminders] VAPID fehlt — kein Web Push (Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)",
    );
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function getPushFailureStatusCode(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status_code?: number };
  const n = Number(e?.statusCode ?? e?.status_code);
  if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  return undefined;
}

function shouldRemoveSubscription(statusCode: number | undefined, errMsg: string): boolean {
  if (statusCode === 404 || statusCode === 410) return true;
  const m = `${errMsg}`;
  if (/VapidPkHashMismatch/i.test(m)) return true;
  if (/BadJwtToken/i.test(m)) return true;
  return false;
}

function endpointPrefix(endpoint: string, max = 96): string {
  const t = (endpoint ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Wie `api/push/send-team.js`: konsistente App-Pfade für Web-Push / sw.js */
function normalizePushAppUrl(raw: string): string {
  let url = (raw ?? "").trim() || "/app/termine";
  if (!url.startsWith("/")) url = `/${url}`;
  if (url === "/termine" || url.startsWith("/termine?") || url.startsWith("/termine#")) {
    return `/app/termine${url.slice("/termine".length)}`;
  }
  if (url === "/nachrichten" || url.startsWith("/nachrichten?") || url.startsWith("/nachrichten#")) {
    return `/app/nachrichten${url.slice("/nachrichten".length)}`;
  }
  return url;
}

/**
 * Einheitlicher JSON-Push wie Team-Push (nur diese Top-Level-Felder + data).
 * Badge-Zahl immer in `data` (auch 0), damit sw.js und Clients identisch reagieren.
 */
function buildTeamAlignedPushPayload(
  title: string,
  body: string,
  urlRaw: string,
  unreadCount: number,
): string {
  const url = normalizePushAppUrl(urlRaw);
  const c = Math.min(99, Math.max(0, Math.floor(Number(unreadCount)) || 0));
  return JSON.stringify({
    title: title.trim() || "SpielzeitApp",
    body: body.trim() || "Neue Benachrichtigung",
    url,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    vibrate: [200, 100, 200],
    data: {
      url,
      unread_count: c,
      badge_count: c,
    },
  });
}

function formatWebPushError(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { body?: string; statusCode?: number };
    const parts = [e.message];
    if (e.body != null && String(e.body).trim() !== "") parts.push(`body=${String(e.body)}`);
    if (e.statusCode != null) parts.push(`statusCode=${e.statusCode}`);
    return parts.join(" | ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Wie `api/push/send-team.js`: push_subscriptions + JSON-Payload + webpush.sendNotification,
 * ungültige Subscriptions entfernen (410/404 / VAPID-Mismatch).
 */
async function sendReminderWebPushes(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  title: string,
  body: string,
  urlRaw: string,
  jobId: string,
): Promise<void> {
  const url = normalizePushAppUrl(urlRaw);
  console.log("Reminder send:", { jobId, title, userCount: userIds.length });

  const vapidOk = ensureVapid();
  if (!vapidOk) {
    console.warn(
      "[send-reminders] VAPID fehlt — kein Web Push (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)",
    );
    console.log("[send-reminders] push skip", { jobId, reason: "no_vapid" });
    return;
  }
  if (userIds.length === 0) {
    console.log("[send-reminders] push skip", { jobId, reason: "no_user_ids" });
    return;
  }

  const { data: subRows, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", userIds)
    .not("endpoint", "is", null);

  if (subErr) {
    console.error("[send-reminders] push_subscriptions query error", {
      jobId,
      message: subErr.message,
      details: (subErr as { details?: string }).details,
      code: (subErr as { code?: string }).code,
    });
    return;
  }

  const rawRows = (subRows ?? []).filter(
    (r: SubRow) => r.endpoint && r.p256dh && r.auth,
  ) as SubRow[];

  /** Gleicher Endpoint nicht zweimal (kein doppeltes sendNotification). */
  const seenEndpoints = new Set<string>();
  const rows: SubRow[] = [];
  for (const r of rawRows) {
    const ep = String(r.endpoint).trim();
    if (seenEndpoints.has(ep)) continue;
    seenEndpoints.add(ep);
    rows.push(r);
  }

  console.log("[send-reminders] push subscriptions", {
    jobId,
    rawRowCount: rawRows.length,
    dedupedRowCount: rows.length,
  });

  let sentOk = 0;
  let sentFail = 0;

  for (const row of rows) {
    const uid = row.user_id;
    let unreadForBadge = 0;
    try {
      const { count, error: cErr } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("read", false);
      if (!cErr && count != null) {
        unreadForBadge = Math.min(99, Math.max(0, Math.floor(Number(count))));
      }
    } catch {
      /* ignore */
    }

    const payload = buildTeamAlignedPushPayload(title, body, url, unreadForBadge);

    const epPrefix = endpointPrefix(row.endpoint);
    console.log("[send-reminders] webpush attempt", { jobId, userId: uid, endpointPrefix: epPrefix });

    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
        { TTL: 86400 },
      );
      sentOk += 1;
      console.log("[send-reminders] webpush ok", { jobId, userId: uid, endpointPrefix: epPrefix });
    } catch (err: unknown) {
      sentFail += 1;
      const msg = formatWebPushError(err);
      const statusCode = getPushFailureStatusCode(err);
      console.error("[send-reminders] webpush failed", {
        jobId,
        userId: uid,
        endpointPrefix: epPrefix,
        statusCode: statusCode ?? null,
        errorMessage: msg,
      });
      if (shouldRemoveSubscription(statusCode, msg)) {
        const { error: delErr } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", row.endpoint.trim());
        if (delErr) {
          console.error("[send-reminders] delete push_subscriptions", delErr.message);
        } else {
          console.log("[send-reminders] removed dead subscription", { endpointPrefix: epPrefix });
        }
      }
    }
  }

  console.log("[send-reminders] webpush batch done", { jobId, sentOk, sentFail, subscriptionRows: rows.length });
}

function formatTimeDe(iso: string | null) {
  if (!iso) return "--:--";
  try {
    return new Intl.DateTimeFormat("de-AT", {
      timeZone: VIENNA_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
}

function formatDateShortDe(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("de-AT", {
      timeZone: VIENNA_TZ,
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function reminderAppDeepLink(kind: string, event: EventRow): string {
  if (kind === "match" && event.match_id) return `/app/match/${event.match_id}`;
  if (kind === "match") return `/app/events/${event.id}`;
  return `/app/events/${event.id}`;
}

async function filterUnansweredMatchRecipients(
  supabase: ReturnType<typeof createClient>,
  event: EventRow,
  userIds: string[],
): Promise<string[]> {
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("event_attendance")
    .select("player_id, status")
    .eq("event_id", event.id);
  if (attendanceError) throw attendanceError;

  const answeredPlayerIds = new Set(
    (attendanceRows ?? [])
      .filter((row: { status?: string | null }) => row.status === "yes" || row.status === "no")
      .map((row: { player_id: string }) => row.player_id),
  );

  const { data: rosterRows, error: rosterError } = await supabase
    .from("team_season_players")
    .select("player_id")
    .eq("team_season_id", event.team_season_id)
    .is("left_at", null);
  if (rosterError) throw rosterError;
  const rosterIds = new Set((rosterRows ?? []).map((row: { player_id: string }) => row.player_id));

  const [{ data: guardianRows, error: guardianError }, { data: playerUserRows, error: playerUserError }] =
    await Promise.all([
      supabase.from("player_guardians").select("user_id, player_id").in("user_id", userIds),
      supabase.from("player_users").select("user_id, player_id").in("user_id", userIds),
    ]);
  if (guardianError) throw guardianError;
  if (playerUserError) throw playerUserError;

  const playersByUser = new Map<string, Set<string>>();
  for (const row of [...(guardianRows ?? []), ...(playerUserRows ?? [])] as Array<{ user_id: string; player_id: string }>) {
    if (!rosterIds.has(row.player_id)) continue;
    const current = playersByUser.get(row.user_id) ?? new Set<string>();
    current.add(row.player_id);
    playersByUser.set(row.user_id, current);
  }

  return userIds.filter((userId) => {
    const playerIds = [...(playersByUser.get(userId) ?? [])];
    return playerIds.length > 0 && playerIds.some((playerId) => !answeredPlayerIds.has(playerId));
  });
}

function buildReminderUxCopy(
  kind: string,
  event: EventRow,
  reminderKey: string | undefined,
): { title: string; message: string } {
  const meetOrStart =
    event.meeting_at && String(event.meeting_at).trim()
      ? event.meeting_at
      : event.starts_at;
  const timeStr = formatTimeDe(meetOrStart);
  if (kind === "match") {
    const opp = (event.opponent ?? "").trim();
    const gegner = opp || "Gegner";
    const title = `⚽ Spiel gegen ${gegner}`;
    const isSecond =
      reminderKey === "match_reminder_2" ||
      reminderKey === "match_second_reminder" ||
      (typeof reminderKey === "string" && reminderKey.includes("second"));
    const dateStr = formatDateShortDe(event.starts_at);
    const message = isSecond
      ? "Deine Rückmeldung fehlt noch. Bitte jetzt verbindlich zu- oder absagen."
      : `Bitte für das Spiel am ${dateStr || "kommenden Termin"} um ${timeStr} Uhr zu- oder absagen.`;
    return { title, message };
  }
  if (kind === "training") {
    return {
      title: "Training",
      message: `Heute um ${timeStr} Uhr. Du bist eingeplant – falls du nicht kommen kannst, bitte absagen.`,
    };
  }
  const dateStr = formatDateShortDe(event.starts_at);
  const startTime = formatTimeDe(event.starts_at);
  return {
    title: "Termin",
    message: `${dateStr} ${startTime} – Treffpunkt nicht vergessen`,
  };
}

async function completeJob(admin: ReturnType<typeof createClient>, id: string) {
  await admin.from("notification_jobs").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "processing");
}

async function failJob(admin: ReturnType<typeof createClient>, id: string, error: string) {
  await admin.from("notification_jobs").update({
    status: "failed",
    last_error: error.slice(0, 2000),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "processing");
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();

    const { data: jobs } = await supabase
      .from("notification_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", now)
      .limit(JOB_BATCH_LIMIT);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }));
    }

    console.log("Jobs gefunden:", jobs.length);

    for (const job of jobs as JobRow[]) {
      const { data: claimed, error: claimErr } = await supabase
        .from("notification_jobs")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();

      if (claimErr) {
        console.error("[send-reminders] claim error", { jobId: job.id, message: claimErr.message });
        continue;
      }
      if (!claimed) {
        console.log("[send-reminders] skip job (already claimed or not pending)", { jobId: job.id });
        continue;
      }

      const locked = claimed as JobRow;

      try {
        const { data: event } = await supabase
          .from("events")
          .select(
            "id, team_season_id, starts_at, meeting_at, opponent, notes, status, match_id",
          )
          .eq("id", locked.event_id)
          .single();

        if (!event) throw new Error("Event nicht gefunden");

        const jobKind = (locked.kind as string) || "event";
        const p = locked.payload && typeof locked.payload === "object"
          ? (locked.payload as Record<string, unknown>)
          : {};
        const isMatchday = p.automation === "matchday_post";
        const st = String(event.status ?? "upcoming").toLowerCase();

        if (isMatchday) {
          if (st === "finished" || st === "canceled") {
            await completeJob(supabase, locked.id);
            continue;
          }
          if (st !== "upcoming" && st !== "live") {
            await completeJob(supabase, locked.id);
            continue;
          }
        } else if (st !== "upcoming") {
          await completeJob(supabase, locked.id);
          continue;
        }

        const { data: members } = await supabase
          .from("memberships")
          .select("user_id")
          .eq("team_season_id", event.team_season_id);

        if (!members || members.length === 0) {
          await completeJob(supabase, locked.id);
          continue;
        }

        let uniqueUserIds = [
          ...new Set(
            members
              .map((m: { user_id: string }) => m.user_id)
              .filter((id: string) => !!id),
          ),
        ];

        if (jobKind === "match" && !isMatchday) {
          uniqueUserIds = await filterUnansweredMatchRecipients(
            supabase,
            event as EventRow,
            uniqueUserIds,
          );
        }

        let uxTitle: string;
        let uxMessage: string;
        let linkPath: string;
        let eventType: string | null = null;

        if (isMatchday) {
          uxTitle = typeof p.pushTitle === "string" && p.pushTitle.trim()
            ? p.pushTitle.trim()
            : "Matchday";
          uxMessage = typeof p.pushBody === "string" ? p.pushBody : "";
          const rawLink = typeof p.linkPath === "string" ? p.linkPath.trim() : "";
          linkPath = rawLink || reminderAppDeepLink(jobKind, event as EventRow);
          eventType = "matchday";
        } else {
          const reminderKey =
            typeof p.reminderKey === "string"
              ? p.reminderKey
              : typeof p.reminder_type === "string"
                ? p.reminder_type
                : undefined;
          const built = buildReminderUxCopy(
            jobKind,
            event as EventRow,
            reminderKey,
          );
          uxTitle = built.title;
          uxMessage = built.message;
          linkPath = reminderAppDeepLink(jobKind, event as EventRow);
        }

        const notifRows = uniqueUserIds.map((userId) => ({
          user_id: userId,
          team_id: locked.team_id,
          event_id: event.id,
          title: uxTitle,
          message: uxMessage,
          type: "auto",
          read: false,
          link: linkPath,
          event_type: eventType,
          source_notification_job_id: locked.id,
        }));

        const { error } = await supabase
          .from("notifications")
          .upsert(notifRows, {
            onConflict: "source_notification_job_id,user_id",
          });

        if (error) throw error;

        await sendReminderWebPushes(
          supabase,
          uniqueUserIds,
          uxTitle,
          uxMessage,
          linkPath,
          locked.id,
        );

        console.log("[send-reminders] job complete", { jobId: locked.id });
        await completeJob(supabase, locked.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[send-reminders] job failed", { jobId: locked.id, error: msg });
        await failJob(supabase, locked.id, msg);
      }
    }

    return new Response(JSON.stringify({ ok: true }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("FATAL:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
    });
  }
});
