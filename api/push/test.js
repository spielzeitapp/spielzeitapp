/**
 * GET / POST /api/push/test
 * Sendet eine Test-Push an alle Zeilen in public.push_subscriptions (web-push).
 * Bei 404/410 wird die Subscription in Supabase gelöscht.
 * GET erlaubt für einfachen Browser-Test.
 */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function ensureVapid() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:team@spielzeitapp.at";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys missing");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * HTTP-Status aus web-push WebPushError (immer statusCode bei HTTP-Fehlerantwort).
 */
function getPushFailureStatusCode(err) {
  if (!err) return undefined;
  const n = Number(err.statusCode ?? err.status_code);
  if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  return undefined;
}

function isGoneSubscriptionStatus(statusCode) {
  return statusCode === 404 || statusCode === 410;
}

/** Kurze Lesbarkeit für Push-HTTP-Fehler (ergänzt err.message). */
function describePushError(err, statusCode) {
  if (statusCode === 404) return "Not Found";
  if (statusCode === 410) return "Gone";
  if (err && typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  if (err) return String(err);
  return "Unknown error";
}

/** Endpunkt gekürzt für Logs/JSON (kein voller Secret-Leak). */
function endpointPreview(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return "(no endpoint)";
  const s = endpoint.trim();
  if (s.length <= 120) return s;
  return `${s.slice(0, 120)}…`;
}

/** Ungültige / abgelaufene Subscriptions entfernen (Push-Dienst meldet Gone/Not Found). */
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

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        step: "env",
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    ensureVapid();

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

    const payload = JSON.stringify({
      title: "SpielzeitApp Test",
      body: "Push funktioniert ✅",
      url: "/termine",
    });

    let sent = 0;
    let failed = 0;
    /** @type {Array<{ endpointPreview: string, success: boolean, statusCode?: number | null, error?: string | null }>} */
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
          { TTL: 3600 }
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
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "catch",
      error: err?.message || String(err),
    });
  }
}
