/**
 * POST /api/push/send-team
 * Sendet Push an Eltern/Spieler eines team_season (nur Trainer/Admin).
 */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import {
  ensureVapid,
  getVapidSendResponseDebug,
  logVapidBeforeSend,
} from "./_vapid.js";

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
  if (s === "parent" || s === "eltern") return "parent";
  if (s === "player" || s === "spieler") return "player";
  if (s === "fan") return "fan";
  return null;
}

function getPushFailureStatusCode(err) {
  if (!err) return undefined;
  const n = Number(err.statusCode ?? err.status_code);
  if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  return undefined;
}

/** Subscription ist ungültig/veraltet und soll aus push_subscriptions entfernt werden */
function shouldRemoveSubscription(statusCode, bodyStr, errMsg) {
  if (statusCode === 404 || statusCode === 410) return true;
  const merged = `${errMsg ?? ""} ${bodyStr ?? ""}`;
  if (/VapidPkHashMismatch/i.test(merged)) return true;
  if (/BadJwtToken/i.test(merged)) return true;
  if (/["']reason["']\s*:\s*["']BadJwtToken["']/i.test(merged)) return true;
  return false;
}

/**
 * Zeile löschen: zuerst endpoint + p256dh + auth, sonst nur endpoint (Fallback).
 * @returns {{ removed: boolean, removalMethod?: string, deleteError?: string }}
 */
async function deletePushSubscriptionRow(supabase, row) {
  const endpoint = typeof row.endpoint === "string" ? row.endpoint.trim() : "";
  if (!endpoint) {
    return { removed: false, deleteError: "no_endpoint" };
  }

  const hasKeys = row.p256dh && row.auth;
  if (hasKeys) {
    const { data: dataTriple, error: errTriple } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("p256dh", row.p256dh)
      .eq("auth", row.auth)
      .select("endpoint");
    if (!errTriple && Array.isArray(dataTriple) && dataTriple.length > 0) {
      return { removed: true, removalMethod: "endpoint+p256dh+auth" };
    }
    if (errTriple) {
      console.error("[push/send-team] delete (triple) failed:", errTriple.message || errTriple);
    }
  }

  const { data: dataEp, error: errEp } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .select("endpoint");
  if (!errEp && Array.isArray(dataEp) && dataEp.length > 0) {
    return { removed: true, removalMethod: hasKeys ? "endpoint_only_fallback" : "endpoint" };
  }
  if (errEp) {
    console.error("[push/send-team] delete (endpoint) failed:", errEp.message || errEp);
    return { removed: false, deleteError: errEp.message || String(errEp) };
  }
  return { removed: false, deleteError: "no_matching_row" };
}

function endpointPreview(endpoint, maxLen = 72) {
  if (!endpoint || typeof endpoint !== "string") return "";
  const t = endpoint.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
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

function formatPushSendError(err, bodyStr) {
  const raw = err?.message ? String(err.message) : String(err);
  const merged = `${raw} ${bodyStr || ""}`;
  if (/VapidPkHashMismatch/i.test(merged)) {
    return `${raw} — VAPID-Mismatch: VITE_VAPID_PUBLIC_KEY (Frontend) und VAPID_PUBLIC_KEY (Backend) müssen identisch sein. Push im Browser deaktivieren und neu aktivieren.`;
  }
  return raw;
}

async function deleteSubscriptionByEndpoint(supabase, endpoint) {
  if (!endpoint || typeof endpoint !== "string") return;
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint.trim());
  if (error) {
    console.error("[push/send-team] delete push_subscriptions failed:", error.message || error);
  }
}

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

function recipientRolesForGroup(group) {
  if (group === "parents") return ["parent"];
  if (group === "players") return ["player"];
  if (group === "all") return ["parent", "player"];
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        step: "env",
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const body = parseBody(req);
    if (body === null) {
      return res.status(400).json({ ok: false, step: "parse", error: "Invalid JSON" });
    }

    const team_season_id =
      typeof body.team_season_id === "string" ? body.team_season_id.trim() : "";
    const recipient_group = body.recipient_group;
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "";
    const textBody =
      typeof body.body === "string" && body.body.trim() ? body.body.trim() : "";
    let url =
      typeof body.url === "string" && body.url.trim() ? body.url.trim() : "/termine";
    if (!url.startsWith("/")) url = `/${url}`;

    const wantedRoles = recipientRolesForGroup(recipient_group);
    if (!team_season_id || !wantedRoles) {
      return res.status(400).json({
        ok: false,
        step: "validate",
        error:
          "team_season_id and recipient_group (parents|players|all) required",
      });
    }
    if (!title || !textBody) {
      return res.status(400).json({
        ok: false,
        step: "validate",
        error: "title and body required",
      });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);
    if (userErr || !user?.id) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const { data: globalRoleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const globalRole = normalizeMembershipRole(globalRoleRow?.role);
    let canSend = globalRole === "admin";

    if (!canSend) {
      const { data: senderMem } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("team_season_id", team_season_id)
        .maybeSingle();
      const mr = normalizeMembershipRole(senderMem?.role);
      canSend = mr === "trainer";
    }

    if (!canSend) {
      return res.status(403).json({
        ok: false,
        error: "Forbidden: trainer or admin only for this team",
      });
    }

    const { data: memRows, error: memErr } = await supabase
      .from("memberships")
      .select("user_id, role")
      .eq("team_season_id", team_season_id);

    if (memErr) {
      return res.status(500).json({
        ok: false,
        step: "memberships",
        error: memErr.message || String(memErr),
      });
    }

    const userIds = [
      ...new Set(
        (memRows || [])
          .filter((m) => {
            const r = normalizeMembershipRole(m.role);
            return r && wantedRoles.includes(r);
          })
          .map((m) => m.user_id)
          .filter(Boolean),
      ),
    ];

    /** user_id → Team-Rolle (memberships) für diese Saison */
    const userIdToRole = new Map();
    for (const m of memRows || []) {
      const r = normalizeMembershipRole(m.role);
      if (m.user_id && r) userIdToRole.set(m.user_id, r);
    }

    if (userIds.length === 0) {
      return res.status(200).json({
        ok: true,
        recipient_group,
        totalRecipients: 0,
        sent: 0,
        failed: 0,
        results: [],
        vapidDebug: getVapidSendResponseDebug(),
      });
    }

    const { data: subRows, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", userIds)
      .not("endpoint", "is", null);

    if (subErr) {
      return res.status(500).json({
        ok: false,
        step: "push_subscriptions",
        error: subErr.message || String(subErr),
      });
    }

    const rows = (subRows || []).filter(
      (r) => r.endpoint && r.p256dh && r.auth,
    );

    const totalRecipients = rows.length;
    if (totalRecipients === 0) {
      return res.status(200).json({
        ok: true,
        recipient_group,
        totalRecipients: 0,
        sent: 0,
        failed: 0,
        results: [],
        vapidDebug: getVapidSendResponseDebug(),
      });
    }

    ensureVapid();

    const payload = JSON.stringify({
      title,
      body: textBody,
      url,
    });

    logVapidBeforeSend("push/send-team", {
      payloadJSON: payload,
      recipientCount: rows.length,
    });

    const uniqueUids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const emailMap = new Map();
    await Promise.all(
      uniqueUids.map(async (uid) => {
        try {
          const { data: uData, error: uErr } =
            await supabase.auth.admin.getUserById(uid);
          if (!uErr && uData?.user?.email) {
            emailMap.set(uid, uData.user.email);
          }
        } catch (e) {
          console.warn("[push/send-team] getUserById failed for", uid, e?.message || e);
        }
      }),
    );

    const results = [];
    let sent = 0;
    let failed = 0;
    let obsoleteSubscriptionsRemoved = 0;

    for (const row of rows) {
      const uid = row.user_id;
      const email = emailMap.get(uid) ?? null;
      const role = userIdToRole.get(uid) ?? null;
      const epPrev = endpointPreview(row.endpoint);

      const baseResult = {
        email,
        role,
        endpointPreview: epPrev,
      };

      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
          { TTL: 3600 },
        );
        sent += 1;
        results.push({
          ...baseResult,
          success: true,
        });
      } catch (err) {
        failed += 1;
        const statusCode = getPushFailureStatusCode(err);
        const bodyStr = safeErrorBody(err);
        const rawMsg = err?.message ? String(err.message) : String(err);
        const formattedError = formatPushSendError(err, bodyStr);

        let subscriptionRemoved = false;
        let removalMethod = null;
        let removalError = null;

        if (shouldRemoveSubscription(statusCode, bodyStr, rawMsg)) {
          const del = await deletePushSubscriptionRow(supabase, row);
          subscriptionRemoved = del.removed;
          removalMethod = del.removalMethod ?? null;
          removalError = del.deleteError ?? null;
          if (del.removed) obsoleteSubscriptionsRemoved += 1;
        }

        results.push({
          ...baseResult,
          success: false,
          statusCode: statusCode ?? null,
          error: formattedError,
          body: bodyStr,
          subscriptionRemoved,
          ...(removalMethod != null ? { removalMethod } : {}),
          ...(removalError != null ? { removalError } : {}),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      recipient_group,
      totalRecipients,
      sent,
      failed,
      results,
      obsoleteSubscriptionsRemoved,
      vapidDebug: {
        ...getVapidSendResponseDebug(),
        obsoleteSubscriptionsRemoved,
      },
    });
  } catch (err) {
    console.error("[push/send-team] full error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      step: "send",
      vapidDebug: getVapidSendResponseDebug(),
    });
  }
}
