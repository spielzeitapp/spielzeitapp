import {
  analyzeMeinTurnierplanUrl,
  extractMeinTurnierplanId,
  TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
  type TournamentPlanAnalysis,
  type TournamentPlanAnalyzeDiagnostics,
  type TournamentPlanAnalyzeFailure,
} from '../../src/lib/tournamentPlanImport';

type VercelLikeReq = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

function queryParam(
  query: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string {
  const raw = query?.[key];
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}

function failureJson(failure: TournamentPlanAnalyzeFailure): Record<string, unknown> {
  return {
    ok: false,
    error: failure.message,
    code: failure.code,
    message: failure.message,
    provider: failure.provider,
    extractedId: failure.extractedId,
    attemptedEndpoints: failure.attemptedEndpoints,
    diagnostics: failure.diagnostics,
  };
}

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed', code: 'parse_failed' });
    return;
  }

  const url = queryParam(req.query, 'url').trim();
  if (!url) {
    res.status(400).json({
      ok: false,
      error: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
      code: 'id_not_found',
      message: 'URL fehlt.',
      provider: 'meinturnierplan',
      extractedId: null,
      attemptedEndpoints: [],
    });
    return;
  }

  try {
    const result = await analyzeMeinTurnierplanUrl(url);

    if (result.ok) {
      res.status(200).json({
        ok: true,
        analysis: result.analysis satisfies TournamentPlanAnalysis,
        diagnostics: result.diagnostics satisfies TournamentPlanAnalyzeDiagnostics,
      });
      return;
    }

    res.status(result.httpStatus).json(failureJson(result.failure));
  } catch {
    res.status(502).json({
      ok: false,
      error: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
      code: 'api_unreachable',
      message: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
      provider: 'meinturnierplan',
      extractedId: extractMeinTurnierplanId(url),
      attemptedEndpoints: [],
    });
  }
}
