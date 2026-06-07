import { analyzeTournamentPlanJson } from './_lib/tournamentPlanJsonAnalyze.js';

export default async function handler(req, res) {
  if (req.query?.debugPing === '1') {
    return res.status(200).json({
      ok: true,
      route: 'tournament-plan-analyze',
      runtime: 'node',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      code: 'parse_failed',
      message: 'Method not allowed',
      provider: 'meinturnierplan',
    });
  }

  const rawUrl = req.query?.url;
  const url =
    typeof rawUrl === 'string'
      ? rawUrl.trim()
      : Array.isArray(rawUrl)
        ? String(rawUrl[0] ?? '').trim()
        : '';

  if (!url) {
    return res.status(400).json({
      ok: false,
      code: 'id_not_found',
      message: 'URL fehlt.',
      provider: 'meinturnierplan',
      extractedId: null,
      attemptedEndpoints: [],
    });
  }

  try {
    const result = await analyzeTournamentPlanJson(url);

    if (result.ok) {
      return res.status(200).json({
        ok: true,
        provider: result.provider,
        extractedId: result.extractedId,
        attemptedEndpoints: result.attemptedEndpoints,
        analysis: result.analysis,
        diagnostics: result.diagnostics,
        teamCount: result.analysis.teamCount,
        groupCount: result.analysis.groupCount,
        matchCount: result.analysis.matchCount,
      });
    }

    return res.status(result.httpStatus).json({
      ok: false,
      provider: result.provider,
      code: result.code,
      message: result.message,
      extractedId: result.extractedId,
      attemptedEndpoints: result.attemptedEndpoints,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      ok: false,
      provider: 'meinturnierplan',
      code: 'api_unreachable',
      message,
      extractedId: null,
      attemptedEndpoints: [],
    });
  }
}
