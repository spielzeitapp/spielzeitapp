export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    route: "ping",
    method: req.method,
    time: new Date().toISOString()
  });
}
