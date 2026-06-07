type VercelLikeReq = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

type AnalyzeServerModule = typeof import('../../src/lib/server/tournamentPlanAnalyzeServer');

type AnalyzeDiagnostics =
  import('../../src/lib/server/tournamentPlanAnalyzeServer').TournamentPlanAnalyzeDiagnostics;
type AnalyzeFailure =
  import('../../src/lib/server/tournamentPlanAnalyzeServer').TournamentPlanAnalyzeFailure;

function queryParam(
  query: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string {
  const raw = query?.[key];
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}

function readFetchRuntimeDiagnostics() {
  return {
    vercel: process.env.VERCEL === '1',
    region: process.env.VERCEL_REGION?.trim() || process.env.AWS_REGION?.trim() || null,
    nodeVersion: process.version,
  };
}

function ensureHtmlFallbackExceptionDiagnostics(
  mod: AnalyzeServerModule,
  diagnostics: AnalyzeDiagnostics,
): AnalyzeDiagnostics {
  if (diagnostics.htmlFallbackException) return diagnostics;
  if (!diagnostics.htmlFallbackAttempted) return diagnostics;
  const errorMessage = diagnostics.htmlFallbackError?.trim();
  if (!errorMessage) return diagnostics;
  return {
    ...diagnostics,
    htmlFallbackException: mod.captureMeinTurnierplanHtmlFallbackException(new Error(errorMessage)),
  };
}

function enrichServerDiagnostics(mod: AnalyzeServerModule, diagnostics: AnalyzeDiagnostics): AnalyzeDiagnostics {
  return ensureHtmlFallbackExceptionDiagnostics(mod, {
    ...diagnostics,
    fetchRuntime: readFetchRuntimeDiagnostics(),
  });
}

function failureJson(mod: AnalyzeServerModule, failure: AnalyzeFailure): Record<string, unknown> {
  return {
    ok: false,
    error: failure.message,
    code: failure.code,
    message: failure.message,
    provider: failure.provider,
    extractedId: failure.extractedId,
    attemptedEndpoints: failure.attemptedEndpoints,
    diagnostics: enrichServerDiagnostics(mod, failure.diagnostics),
  };
}

function htmlFallbackServerErrorJson(
  mod: AnalyzeServerModule,
  url: string,
  err: unknown,
): Record<string, unknown> {
  const captured = mod.captureMeinTurnierplanFetchException(err);
  const htmlFallbackException = mod.captureMeinTurnierplanHtmlFallbackException(err);
  const extractedId = mod.extractMeinTurnierplanId(url);
  const attemptedEndpoints = extractedId ? mod.buildMeinTurnierplanJsonEndpoints(extractedId) : [];

  return {
    ok: false,
    code: 'html_fallback_server_error',
    message: 'HTML-Fallback konnte serverseitig nicht ausgeführt werden.',
    error: captured.exceptionMessage || 'HTML-Fallback konnte serverseitig nicht ausgeführt werden.',
    provider: 'meinturnierplan',
    extractedId,
    attemptedEndpoints,
    diagnostics: enrichServerDiagnostics(mod, {
      linkRecognized: mod.isSupportedTournamentPlanHost(url),
      idExtracted: Boolean(extractedId),
      extractedId,
      apiReachable: false,
      provider: 'meinturnierplan',
      attemptedEndpoints,
      htmlFallbackAttempted: true,
      htmlFallbackSuccessful: false,
      htmlFallbackError: captured.exceptionMessage || 'HTML-Fallback konnte serverseitig nicht ausgeführt werden.',
      htmlFallbackException,
      serverException: {
        name: captured.exceptionName,
        message: captured.exceptionMessage,
      },
      source: 'html_fallback',
      fallbackStage: 'html',
      analyzeLastStep: 'html_fallback',
    }),
  };
}

async function handleAnalyzeRequest(
  req: VercelLikeReq,
  res: VercelLikeRes,
  mod: AnalyzeServerModule,
): Promise<void> {
  const url = queryParam(req.query, 'url').trim();
  if (!url) {
    res.status(400).json({
      ok: false,
      error: mod.TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
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
    const result = forceHtmlFallback
      ? await mod.analyzeMeinTurnierplanUrlForceHtmlFallback(url)
      : await mod.analyzeMeinTurnierplanUrl(url);

    if (result.ok) {
      res.status(200).json({
        ok: true,
        analysis: result.analysis,
        diagnostics: enrichServerDiagnostics(mod, result.diagnostics),
      });
      return;
    }

    res.status(result.httpStatus).json(failureJson(mod, result.failure));
  } catch (err) {
    if (forceHtmlFallback) {
      res.status(500).json(htmlFallbackServerErrorJson(mod, url, err));
      return;
    }

    const captured = mod.captureMeinTurnierplanFetchException(err);
    const extractedId = mod.extractMeinTurnierplanId(url);
    const attemptedEndpoints = extractedId ? mod.buildMeinTurnierplanJsonEndpoints(extractedId) : [];
    const refererUrl = extractedId
      ? /showit\.php/i.test(url)
        ? mod.normalizeTournamentPlanUrl(url)
        : mod.buildMeinTurnierplanShowitUrl(extractedId)
      : '';

    let htmlFallbackError: string | null = null;
    let htmlFallbackException: AnalyzeDiagnostics['htmlFallbackException'] = null;

    if (extractedId && refererUrl) {
      try {
        const htmlAfterException = await mod.tryMeinTurnierplanHtmlFallbackAnalyze({
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
            analysis: htmlAfterException.analysis,
            diagnostics: enrichServerDiagnostics(mod, htmlAfterException.diagnostics),
          });
          return;
        }
        htmlFallbackError = htmlAfterException.error;
        htmlFallbackException =
          htmlAfterException.htmlFallbackException ??
          mod.captureMeinTurnierplanHtmlFallbackException(new Error(htmlAfterException.error));
      } catch (htmlErr) {
        const htmlCaptured = mod.captureMeinTurnierplanFetchException(htmlErr);
        htmlFallbackError = htmlCaptured.exceptionMessage;
        htmlFallbackException = mod.captureMeinTurnierplanHtmlFallbackException(htmlErr);
      }
    }

    const failure = mod.buildTournamentPlanAnalyzeFailure({
      code: 'api_unreachable',
      extractedId,
      attemptedEndpoints,
      apiReachable: false,
      linkRecognized: mod.isSupportedTournamentPlanHost(url),
      idExtracted: Boolean(extractedId),
      showitPageReachable: null,
      source: 'server_api',
      serverException: {
        name: captured.exceptionName,
        message: captured.exceptionMessage,
      },
      htmlFallbackAttempted: Boolean(extractedId),
      htmlFallbackSuccessful: false,
      htmlFallbackError:
        htmlFallbackError ?? (extractedId ? mod.MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE : null),
      htmlFallbackException,
      fallbackStage: extractedId ? 'html' : 'json',
    });
    res.status(502).json(failureJson(mod, failure));
  }
}

function minimalFatalJson(err: unknown): Record<string, unknown> {
  const message = err instanceof Error ? err.message : String(err);
  return {
    ok: false,
    code: 'html_fallback_server_error',
    message: 'HTML-Fallback konnte serverseitig nicht ausgeführt werden.',
    error: message,
  };
}

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ ok: false, error: 'Method not allowed', code: 'parse_failed' });
      return;
    }

    const debugPing = queryParam(req.query, 'debugPing');
    if (debugPing === '1') {
      res.status(200).json({ ok: true, route: 'analyze', runtime: 'node' });
      return;
    }

    const mod = await import('../../src/lib/server/tournamentPlanAnalyzeServer');
    await handleAnalyzeRequest(req, res, mod);
  } catch (fatalErr) {
    try {
      const url = queryParam(req.query, 'url').trim();
      const forceHtmlRaw = queryParam(req.query, 'forceHtmlFallback');
      const forceHtmlFallback = forceHtmlRaw === '1' || forceHtmlRaw.toLowerCase() === 'true';

      if (forceHtmlFallback && url) {
        try {
          const mod = await import('../../src/lib/server/tournamentPlanAnalyzeServer');
          res.status(500).json(htmlFallbackServerErrorJson(mod, url, fatalErr));
          return;
        } catch {
          /* module load failed */
        }
      }

      try {
        const mod = await import('../../src/lib/server/tournamentPlanAnalyzeServer');
        const captured = mod.captureMeinTurnierplanFetchException(fatalErr);
        res.status(500).json({
          ok: false,
          code: 'api_unreachable',
          message: captured.exceptionMessage || mod.TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
          error: captured.exceptionMessage || mod.TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
          provider: 'meinturnierplan',
          extractedId: mod.extractMeinTurnierplanId(url),
          attemptedEndpoints: [],
          diagnostics: enrichServerDiagnostics(mod, {
            linkRecognized: mod.isSupportedTournamentPlanHost(url),
            idExtracted: Boolean(mod.extractMeinTurnierplanId(url)),
            extractedId: mod.extractMeinTurnierplanId(url),
            apiReachable: false,
            provider: 'meinturnierplan',
            attemptedEndpoints: [],
            serverException: {
              name: captured.exceptionName,
              message: captured.exceptionMessage,
            },
            source: 'server_api',
            fallbackStage: 'json',
          }),
        });
        return;
      } catch {
        res.status(500).json(minimalFatalJson(fatalErr));
      }
    } catch {
      try {
        res.status(500).json(minimalFatalJson(fatalErr));
      } catch {
        /* response already sent */
      }
    }
  }
}
