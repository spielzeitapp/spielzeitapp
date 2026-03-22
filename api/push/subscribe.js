import { createClient } from "@supabase/supabase-js";
import { getVapidDebugInfo } from "./_vapid.js";

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

function shortEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== "string") return "(none)";
  const s = endpoint.trim();
  if (s.length <= 72) return s;
  return `${s.slice(0, 72)}…`;
}

function mapSupabaseInsertError(error) {
  const msg = error?.message || String(error);
  const code = error?.code;
  if (
    code === "42P01" ||
    /does not exist/i.test(msg) ||
    /relation ["'].*push_subscriptions/i.test(msg)
  ) {
    return {
      status: 500,
      body: {
        ok: false,
        step: "supabase",
        error:
          "Tabelle push_subscriptions nicht gefunden. Migrationen auf dem Server ausführen.",
      },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      step: "supabase",
      error: msg,
      code: code || undefined,
    },
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "POST JSON mit endpoint + keys; VAPID-Debug (Server-Env)",
        vapid: getVapidDebugInfo(),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        step: "method",
        error: "Method not allowed",
      });
    }

    const body = parseBody(req);
    if (body === null) {
      return res.status(400).json({
        ok: false,
        step: "parse",
        error: "Invalid JSON",
      });
    }

    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({
        ok: false,
        step: "validate",
        error: "Invalid payload",
        body,
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        step: "supabase",
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const userId = body.user_id || null;
    const ts = new Date().toISOString();

    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers["user-agent"] || null,
    });

    if (error) {
      const mapped = mapSupabaseInsertError(error);
      console.error("[push/subscribe] insert failed:", error);
      return res.status(mapped.status).json(mapped.body);
    }

    console.log(
      "[push/subscribe] saved",
      JSON.stringify({
        user_id: userId,
        endpoint: shortEndpoint(endpoint),
        at: ts,
      })
    );

    return res.status(200).json({
      ok: true,
      step: "saved",
    });
  } catch (err) {
    console.error("[push/subscribe] catch:", err);
    return res.status(500).json({
      ok: false,
      step: "subscribe",
      error: err?.message || String(err),
    });
  }
}
