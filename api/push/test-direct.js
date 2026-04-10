/**
 * POST /api/push/test-direct
 * Ein Web-Push nur an den eingeloggten User (push_subscriptions) + eine notifications-Zeile.
 * Nur Trainer/Admin — gleiche Idee wie Trainer-Tools.
 */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { ensureVapid, logVapidBeforeSend } from "./_vapid.js";

const TEST_TITLE = "SpielzeitApp Test";
const TEST_BODY = "Direkter Push funktioniert";
const TEST_URL = "/app";

function normalizeMembershipRole(roleStr) {
  const s = String(roleStr ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === "administrator" || s === "admin") return "admin";
  if (
    s === "head_coach" ||
    s === "headcoach" ||
    s === "coach" ||
    s === "co_trainer" ||
    s === "co-trainer" ||
    s === "trainer"
  )
    return "trainer";
  return null;
}

function getPushFailureStatusCode(err) {
  if (!err) return undefined;
  const n = Number(err.statusCode ?? err.status_code);
  if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  return undefined;
}

function safeErrorBody(err) {
  if (err == null || err.body == null) return undefined;
  let s;
  if (typeof err.body === "string") s = err.body;
  else if (typeof Buffer !== "undefined" && Buffer.isBuffer(err.body))
    s = err.body.toString("utf8");
  else s = String(err.body);
  if (s.length > 2000) return `${s.slice(0, 2000)}…`;
  return s;
}

async function canUseTrainerDirectPush(supabase, userId) {
  const { data: gr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (normalizeMembershipRole(gr?.role) === "admin") return true;
  const { data: mems } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId);
  for (const m of mems ?? []) {
    const r = normalizeMembershipRole(m.role);
    if (r === "trainer") return true;
  }
  return false;
}

export default async function handler(req, res) {
  const lines = [];
  const log = (msg, data) => {
    const entry = data !== undefined ? `${msg} ${JSON.stringify(data)}` : msg;
    lines.push(entry);
    console.log(`[push/test-direct] ${msg}`, data !== undefined ? data : "");
  };

  try {
    log("direct push start");

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed", logs: lines });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, step: "env", error: "Missing Supabase env", logs: lines });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return res.status(401).json({ ok: false, error: "Unauthorized", logs: lines });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);
    if (userErr || !user?.id) {
      log("auth failed", userErr?.message ?? "no user");
      return res.status(401).json({ ok: false, error: "Invalid session", logs: lines });
    }

    const userId = user.id;
    log("current user id", userId);

    const allowed = await canUseTrainerDirectPush(supabase, userId);
    if (!allowed) {
      log("forbidden", "not trainer/admin");
      return res.status(403).json({ ok: false, error: "Forbidden: trainer tools only", logs: lines });
    }

    const { data: subRows, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .eq("user_id", userId)
      .not("endpoint", "is", null);

    if (subErr) {
      log("push_subscriptions query error", subErr.message);
      return res.status(500).json({ ok: false, step: "push_subscriptions", error: subErr.message, logs: lines });
    }

    const rows = (subRows || []).filter((r) => r.endpoint && r.p256dh && r.auth);
    log("subscriptions found count", rows.length);

    let notificationOk = false;
    let notificationError = null;
    try {
      const { data: mem } = await supabase
        .from("memberships")
        .select("team_season_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      let teamId = null;
      if (mem?.team_season_id) {
        const { data: ts } = await supabase
          .from("team_seasons")
          .select("team_id")
          .eq("id", mem.team_season_id)
          .maybeSingle();
        teamId = ts?.team_id ?? null;
      }
      const ins = {
        user_id: userId,
        title: TEST_TITLE,
        message: TEST_BODY,
        read: false,
        type: "manual_push",
        link: TEST_URL,
        ...(teamId != null ? { team_id: teamId } : {}),
      };
      const { error: nErr } = await supabase.from("notifications").insert(ins);
      if (nErr) {
        notificationError = nErr.message || String(nErr);
        log("notification insert error", notificationError);
      } else {
        notificationOk = true;
        log("notification insert ok", true);
      }
    } catch (e) {
      notificationError = e instanceof Error ? e.message : String(e);
      log("notification insert exception", notificationError);
    }

    if (rows.length === 0) {
      log("send skipped", "no push_subscriptions for user");
      return res.status(200).json({
        ok: true,
        pushed: 0,
        message: "No subscriptions — enable Push in Profil",
        notificationInserted: notificationOk,
        notificationError,
        logs: lines,
      });
    }

    try {
      ensureVapid();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("VAPID error", msg);
      return res.status(500).json({
        ok: false,
        step: "vapid",
        error: msg,
        notificationInserted: notificationOk,
        notificationError,
        logs: lines,
      });
    }

    logVapidBeforeSend("push/test-direct", { recipientCount: rows.length });

    const batchTs = Date.now();
    let sentOk = 0;
    const sendErrors = [];

    for (const row of rows) {
      const epPrev =
        typeof row.endpoint === "string" && row.endpoint.length > 72
          ? `${row.endpoint.slice(0, 72)}…`
          : row.endpoint;
      log("endpoint prefix", epPrev);

      let unreadForBadge = null;
      try {
        const { count, error: cErr } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("read", false);
        if (!cErr && count != null) {
          unreadForBadge = Math.min(99, Math.max(0, Math.floor(Number(count))));
        }
      } catch {
        /* ignore */
      }

      const pushTag = `direct-test-${batchTs}`;
      const payloadObj = {
        title: TEST_TITLE,
        body: TEST_BODY,
        url: TEST_URL,
        tag: pushTag,
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        vibrate: [200, 100, 200],
        data: { url: TEST_URL },
      };
      if (unreadForBadge != null) {
        payloadObj.appBadgeCount = unreadForBadge;
        payloadObj.unread_count = unreadForBadge;
        payloadObj.badge_count = unreadForBadge;
        payloadObj.data = {
          url: TEST_URL,
          unread_count: unreadForBadge,
          badge_count: unreadForBadge,
        };
      }
      const payload = JSON.stringify(payloadObj);

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
        log("send success", { endpointPrefix: epPrev });
      } catch (err) {
        const raw = err?.message ? String(err.message) : String(err);
        const bodyStr = safeErrorBody(err);
        const statusCode = getPushFailureStatusCode(err);
        const exact = bodyStr ? `${raw} | body=${bodyStr}` : raw;
        log("send failed exact error", { endpointPrefix: epPrev, statusCode, errorMessage: exact });
        sendErrors.push({ endpointPrefix: epPrev, statusCode, error: exact });
      }
    }

    log("direct push done", { sendSuccessCount: sentOk, subscriptionsTotal: rows.length });

    return res.status(200).json({
      ok: true,
      pushed: sentOk,
      attempted: rows.length,
      sendErrors,
      notificationInserted: notificationOk,
      notificationError,
      logs: lines,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[push/test-direct] FATAL", msg);
    return res.status(500).json({ ok: false, error: msg, logs: lines });
  }
}
