export default function handler(req, res) {
  if (req.query.debugPing === '1') {
    return res.status(200).json({
      ok: true,
      route: 'tournament-plan-analyze',
      runtime: 'node',
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(501).json({
    ok: false,
    message: 'Analyze temporarily disabled for diagnostics',
  });
}
