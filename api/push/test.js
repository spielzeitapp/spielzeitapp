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

    for (const row of rows || []) {
      if (!row?.endpoint || !row?.p256dh || !row?.auth) {
        failed += 1;
        continue;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
          { TTL: 3600 }
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const statusCode = getPushFailureStatusCode(err);
        if (isGoneSubscriptionStatus(statusCode)) {
          await deleteSubscriptionByEndpoint(supabase, row.endpoint);
        }
      }
    }

    return res.status(200).json({ ok: true, sent, failed });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "catch",
      error: err?.message || String(err),
    });
  }
}
