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

function getStatusCode(err) {
  if (err && typeof err.statusCode === "number") return err.statusCode;
  if (err && typeof err.status_code === "number") return err.status_code;
  return undefined;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        step: "method",
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
        const statusCode = getStatusCode(err);
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint);
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
