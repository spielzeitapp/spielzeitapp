import {
  analyzeMeinTurnierplanUrl,
  analyzeMeinTurnierplanUrlForceHtmlFallback,
  buildMeinTurnierplanJsonEndpoints,
  buildMeinTurnierplanShowitUrl,
  buildTournamentPlanAnalyzeFailure,
  captureMeinTurnierplanFetchException,
  extractMeinTurnierplanId,
  isSupportedTournamentPlanHost,
  normalizeTournamentPlanUrl,
  MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE,
  TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
  tryMeinTurnierplanHtmlFallbackAnalyze,
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
    nodeVersion: process.version,
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

  const forceHtmlRaw = queryParam(req.query, 'forceHtmlFallback');
  const forceHtmlFallback = forceHtmlRaw === '1' || forceHtmlRaw.toLowerCase() === 'true';

  try {
    // forceHtmlFallback=1: JSON überspringen, showit.php serverseitig + parseMeinTurnierplanHtml.
    const result = forceHtmlFallback
      ? await analyzeMeinTurnierplanUrlForceHtmlFallback(url)
      : await analyzeMeinTurnierplanUrl(url);

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
    const attemptedEndpoints = extractedId ? buildMeinTurnierplanJsonEndpoints(extractedId) : [];
    const refererUrl = extractedId
      ? /showit\.php/i.test(url)
        ? normalizeTournamentPlanUrl(url)
        : buildMeinTurnierplanShowitUrl(extractedId)
      : '';

    let htmlFallbackError: string | null = null;
    let htmlFallbackException: TournamentPlanAnalyzeDiagnostics['htmlFallbackException'] = null;
    if (extractedId && refererUrl) {
      const htmlAfterException = await tryMeinTurnierplanHtmlFallbackAnalyze({
        showitUrl: refererUrl,
        extractedId,
        fetchImpl: fetch,
        attemptedEndpoints,
        apiReachable: false,
        showitPageReachable: null,
      });
      if (htmlAfterException.ok) {
        res.status(200).json({
          ok: true,
          analysis: htmlAfterException.analysis satisfies TournamentPlanAnalysis,
          diagnostics: enrichServerDiagnostics(
            htmlAfterException.diagnostics satisfies TournamentPlanAnalyzeDiagnostics,
          ),
        });
        return;
      }
      htmlFallbackError = htmlAfterException.error;
      htmlFallbackException = htmlAfterException.htmlFallbackException ?? null;
    }

    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'api_unreachable',
      extractedId,
      attemptedEndpoints,
      apiReachable: false,
      linkRecognized: isSupportedTournamentPlanHost(url),
      idExtracted: Boolean(extractedId),
      showitPageReachable: null,
      source: 'server_api',
      serverException: {
        name: captured.exceptionName,
        message: captured.exceptionMessage,
      },
      htmlFallbackAttempted: Boolean(extractedId),
      htmlFallbackSuccessful: false,
      htmlFallbackError: htmlFallbackError ?? (extractedId ? MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE : null),
      htmlFallbackException,
      fallbackStage: extractedId ? 'html' : 'json',
    });
    res.status(502).json(failureJson(failure));
  }
}
