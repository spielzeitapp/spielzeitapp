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

    return res.status(200).json({
      ok: true,
      step: "working",
      endpointPreview: endpoint.slice(0, 40),
      hasP256dh: !!p256dh,
      hasAuth: !!auth
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "catch",
      error: err?.message || String(err)
    });
  }
}
