/**
 * GET  /api/push/test — Readiness + VAPID-Debug (kein Versand)
 * POST /api/push/test — Test-Push an alle Zeilen in public.push_subscriptions
 * POST + Body { "directSelf": true } + Bearer — nur aktueller User (Trainer/Admin), + notifications-Zeile
 * Bei 404/410 wird die Subscription gelöscht (nur Broadcast-Zweig).
 */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { ensureVapid, getVapidDebugInfo, logVapidBeforeSend } from "./_vapid.js";

const DIRECT_SELF_TITLE = "SpielzeitApp Test";
const DIRECT_SELF_BODY = "Direkter Push funktioniert";
const DIRECT_SELF_URL = "/app";

function parseBody(req) {
  try {
    if (typeof req.body === "string") {
      return req.body ? JSON.parse(req.body) : {};
    }
    if (req.body && typeof req.body === "object") return req.body;
  } catch {
    return null;
  }
  return {};
}

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

async function runDirectSelfTest(req, res) {
  const lines = [];
  const log = (msg, data) => {
    const entry = data !== undefined ? `${msg} ${JSON.stringify(data)}` : msg;
    lines.push(entry);
    console.log(`[push/test] directSelf ${msg}`, data !== undefined ? data : "");
  };

  try {
    log("direct push start");

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
        title: DIRECT_SELF_TITLE,
        message: DIRECT_SELF_BODY,
        read: false,
        type: "manual_push",
        link: DIRECT_SELF_URL,
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

    logVapidBeforeSend("push/test", { mode: "directSelf", recipientCount: rows.length });

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
        title: DIRECT_SELF_TITLE,
        body: DIRECT_SELF_BODY,
        url: DIRECT_SELF_URL,
        tag: pushTag,
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        vibrate: [200, 100, 200],
        data: { url: DIRECT_SELF_URL },
      };
      if (unreadForBadge != null) {
        payloadObj.appBadgeCount = unreadForBadge;
        payloadObj.unread_count = unreadForBadge;
        payloadObj.badge_count = unreadForBadge;
        payloadObj.data = {
          url: DIRECT_SELF_URL,
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
    console.error("[push/test] directSelf FATAL", msg);
    return res.status(500).json({ ok: false, error: msg, logs: lines });
  }
}

function getPushFailureStatusCode(err) {
  if (!err) return undefined;
  const n = Number(err.statusCode ?? err.status_code);
  if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  return undefined;
}

function isGoneSubscriptionStatus(statusCode) {
  return statusCode === 404 || statusCode === 410;
}

function describePushError(err, statusCode) {
  if (statusCode === 404) return "Not Found";
  if (statusCode === 410) return "Gone";
  let msg = "";
  if (err && typeof err.message === "string" && err.message.trim()) {
    msg = err.message.trim();
  } else if (err) {
    msg = String(err);
  } else {
    msg = "Unknown error";
  }
  if (/VapidPkHashMismatch/i.test(msg)) {
    return `${msg} — VAPID-Mismatch: VITE_VAPID_PUBLIC_KEY und VAPID_PUBLIC_KEY müssen identisch sein; Push neu aktivieren.`;
  }
  return msg;
}

function endpointPreview(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return "(no endpoint)";
  const s = endpoint.trim();
  if (s.length <= 120) return s;
  return `${s.slice(0, 120)}…`;
}

async function deleteSubscriptionByEndpoint(supabase, endpoint) {
  if (!endpoint || typeof endpoint !== "string") return;
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint.trim());
  if (error) {
    console.error("[push/test] delete push_subscriptions failed:", error.message || error);
  }
}

async function runBroadcastTest(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      ok: false,
      step: "env",
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  ensureVapid();

  logVapidBeforeSend("push/test", { mode: "broadcast-test" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) {
    return res.status(500).json({
      ok: false,
      step: "supabase",
      error: error.message || String(error),
    });
  }

  const pathUrl = "/app/termine";
  const demoBadge = 1;
  const payload = JSON.stringify({
    title: "SpielzeitApp Test",
    body: "Push funktioniert ✅",
    url: pathUrl,
    tag: `spielzeit-test-${Date.now()}`,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    vibrate: [200, 100, 200],
    appBadgeCount: demoBadge,
    unread_count: demoBadge,
    badge_count: demoBadge,
    data: { url: pathUrl, unread_count: demoBadge, badge_count: demoBadge },
  });

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const row of rows || []) {
    const preview = endpointPreview(row?.endpoint);

    if (!row?.endpoint || !row?.p256dh || !row?.auth) {
      failed += 1;
      results.push({
        endpointPreview: preview,
        success: false,
        statusCode: null,
        error: "Missing endpoint, p256dh, or auth in row",
      });
      continue;
    }

    try {
      const sendResult = await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
        { TTL: 86400 }
      );
      sent += 1;
      const okCode =
        sendResult && typeof sendResult.statusCode === "number"
          ? sendResult.statusCode
          : null;
      results.push({
        endpointPreview: preview,
        success: true,
        statusCode: okCode,
        error: null,
      });
    } catch (err) {
      failed += 1;
      const statusCode = getPushFailureStatusCode(err);
      const errMsg = describePushError(err, statusCode);
      results.push({
        endpointPreview: preview,
        success: false,
        statusCode: statusCode ?? null,
        error: errMsg,
      });
      if (isGoneSubscriptionStatus(statusCode)) {
        await deleteSubscriptionByEndpoint(supabase, row.endpoint);
      }
    }
  }

  return res.status(200).json({ ok: true, sent, failed, results });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "Push API ready",
        time: new Date().toISOString(),
        vapid: getVapidDebugInfo(),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    const body = parseBody(req);
    if (body && body.directSelf === true) {
      return await runDirectSelfTest(req, res);
    }

    return await runBroadcastTest(req, res);
  } catch (err) {
    console.error("[push/test] full error:", err);
    return res.status(500).json({
      ok: false,
      step: "send",
      error: err?.message || String(err),
    });
  }
}
