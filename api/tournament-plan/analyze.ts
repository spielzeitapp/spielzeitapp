import {
  analyzeMeinTurnierplanUrl,
  buildMeinTurnierplanJsonEndpoints,
  buildTournamentPlanAnalyzeFailure,
  captureMeinTurnierplanFetchException,
  extractMeinTurnierplanId,
  isSupportedTournamentPlanHost,
  TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
  type TournamentPlanAnalysis,
  type TournamentPlanAnalyzeDiagnostics,
  type TournamentPlanAnalyzeFailure,
  type TournamentPlanFetchRuntimeDiagnostics,
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

function readFetchRuntimeDiagnostics(): TournamentPlanFetchRuntimeDiagnostics {
  return {
    vercel: process.env.VERCEL === '1',
    region: process.env.VERCEL_REGION?.trim() || null,
  };
}

function enrichServerDiagnostics(
  diagnostics: TournamentPlanAnalyzeDiagnostics,
): TournamentPlanAnalyzeDiagnostics {
  return {
    ...diagnostics,
    fetchRuntime: readFetchRuntimeDiagnostics(),
  };
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
    diagnostics: enrichServerDiagnostics(failure.diagnostics),
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
    // JSON-Endpoints zuerst; bei Fehler showit.php + parseMeinTurnierplanHtml (preloadedState / sichtbares HTML).
    const result = await analyzeMeinTurnierplanUrl(url);

    if (result.ok) {
      res.status(200).json({
        ok: true,
        analysis: result.analysis satisfies TournamentPlanAnalysis,
        diagnostics: enrichServerDiagnostics(
          result.diagnostics satisfies TournamentPlanAnalyzeDiagnostics,
        ),
      });
      return;
    }

    res.status(result.httpStatus).json(failureJson(result.failure));
  } catch (err) {
    const captured = captureMeinTurnierplanFetchException(err);
    const extractedId = extractMeinTurnierplanId(url);
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'api_unreachable',
      extractedId,
      attemptedEndpoints: extractedId ? buildMeinTurnierplanJsonEndpoints(extractedId) : [],
      apiReachable: false,
      linkRecognized: isSupportedTournamentPlanHost(url),
      idExtracted: Boolean(extractedId),
      showitPageReachable: null,
      source: 'server_api',
      serverException: {
        name: captured.exceptionName,
        message: captured.exceptionMessage,
      },
    });
    res.status(502).json(failureJson(failure));
  }
}
