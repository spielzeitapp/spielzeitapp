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

    let body = {};
    try {
      if (typeof req.body === "string") {
        body = req.body ? JSON.parse(req.body) : {};
      } else if (req.body && typeof req.body === "object") {
        body = req.body;
      }
    } catch {
      return res.status(400).json({
        ok: false,
        step: "parse",
        error: "Invalid JSON",
      });
    }

    const endpoint = body?.endpoint;

    if (!endpoint || typeof endpoint !== "string") {
      return res.status(400).json({
        ok: false,
        step: "validate",
        error: "endpoint required"
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        step: "supabase",
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      return res.status(500).json({
        ok: false,
        step: "supabase",
        error: error.message || String(error)
      });
    }

    return res.status(200).json({ ok: true, step: "deleted" });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "catch",
      error: err?.message || String(err)
    });
  }
}
