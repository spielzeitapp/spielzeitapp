import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        step: "method",
        error: "Method not allowed"
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({
        ok: false,
        step: "validate",
        error: "Invalid payload",
        body
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        step: "supabase",
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: body.user_id || null,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers["user-agent"] || null
    });

    if (error) {
      return res.status(500).json({
        ok: false,
        step: "supabase",
        error: error.message || String(error)
      });
    }

    return res.status(200).json({
      ok: true,
      step: "saved"
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "supabase",
      error: err?.message || String(err)
    });
  }
}
