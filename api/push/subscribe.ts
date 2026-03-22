export default async function handler(req, res) {
  try {
    let step = "start";

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    step = "parse_body";

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    step = "validate";

    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({
        ok: false,
        step,
        error: "Invalid payload",
        body
      });
    }

    return res.status(200).json({
      ok: true,
      step: "working",
      endpointPreview: endpoint.slice(0, 40)
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "unknown",
      stack: err.stack || null
    });
  }
}
