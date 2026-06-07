import React from 'react';
import {
  TOURNAMENT_IMPORT_MANUAL_HINT,
  formatEndpointAttemptSummary,
  labelForTournamentPlanAnalyzeSource,
  type TournamentPlanAnalyzeDiagnostics,
  type TournamentPlanAnalyzeFailure,
} from '../../lib/tournamentPlanImport';

type Props = {
  failure: TournamentPlanAnalyzeFailure | null;
  diagnostics: TournamentPlanAnalyzeDiagnostics | null;
};

function yesNo(value: boolean): string {
  return value ? 'ja' : 'nein';
}

function yesNoUnknown(value: boolean | null | undefined): string {
  if (value === true) return 'ja';
  if (value === false) return 'nein';
  return '—';
}

function HtmlFallbackExceptionDetails({
  exception,
}: {
  exception: NonNullable<TournamentPlanAnalyzeDiagnostics['htmlFallbackException']>;
}) {
  return (
    <li className="break-words text-amber-50/95">
      <div className="font-medium text-amber-50">HTML-Fallback Exception</div>
      <dl className="mt-1 space-y-0.5 font-mono text-[10px] leading-snug text-white/80">
        <div>
          <dt className="inline text-white/50">name: </dt>
          <dd className="inline">{exception.name || '—'}</dd>
        </div>
        <div>
          <dt className="inline text-white/50">message: </dt>
          <dd className="inline break-all">{exception.message || '—'}</dd>
        </div>
        <div>
          <dt className="inline text-white/50">code: </dt>
          <dd className="inline">{exception.code ?? '—'}</dd>
        </div>
        <div>
          <dt className="inline text-white/50">cause: </dt>
          <dd className="inline break-all">{exception.cause ?? '—'}</dd>
        </div>
      </dl>
    </li>
  );
}

export const TournamentPlanAnalyzeDebugPanel: React.FC<Props> = ({ failure, diagnostics }) => {
  const d = failure?.diagnostics ?? diagnostics;
  if (!d && !failure) return null;

  const endpointAttempts =
    d?.endpointAttempts ??
    (d?.attemptedEndpoints ?? []).map((endpoint) => ({
      endpoint,
      finalUrl: null,
      httpStatus: null,
      networkError: false,
      errorDetail: null,
      exceptionName: null,
      exceptionMessage: null,
      parseCode: null,
    }));

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-3 text-[13px] text-amber-100/90"
      role="alert"
    >
      {failure ? <p className="font-medium text-amber-50/95">{failure.message}</p> : null}

      {d ? (
        <ul className="mt-2 space-y-0.5 text-[12px] text-white/70">
          <li>Link erkannt: {yesNo(d.linkRecognized)}</li>
          <li>
            Turnier-ID erkannt:{' '}
            {d.idExtracted && d.extractedId ? (
              <span className="font-mono text-white/90">{d.extractedId}</span>
            ) : (
              'nicht erkannt'
            )}
          </li>
          <li>showit.php erreichbar: {yesNoUnknown(d.showitPageReachable)}</li>
          <li>JSON-API erreichbar: {yesNo(d.apiReachable)}</li>
          <li>Datenquelle: {labelForTournamentPlanAnalyzeSource(d.source)}</li>
          {d.analyzeLastStep ? <li>letzter Schritt: {d.analyzeLastStep}</li> : null}
          {d.analyzeTimedOut != null ? <li>timeout: {yesNo(d.analyzeTimedOut)}</li> : null}
          {d.fallbackStage ? <li>Fallback-Stufe: {d.fallbackStage}</li> : null}
          <li>Browser-Fallback versucht: {yesNo(Boolean(d.browserFallbackAttempted))}</li>
          {d.browserFallbackAttempted && d.browserFallbackError ? (
            <li className="break-words text-amber-100/85">
              Browser-Fallback Fehler: {d.browserFallbackError}
            </li>
          ) : null}
          <li>HTML-Fallback versucht: {yesNo(Boolean(d.htmlFallbackAttempted))}</li>
          {d.htmlFallbackAttempted ? (
            <li>HTML-Fallback erfolgreich: {yesNo(Boolean(d.htmlFallbackSuccessful))}</li>
          ) : null}
          {d.htmlFallbackRequestUrl ? (
            <li className="break-all font-mono text-[10px] leading-snug text-white/75">
              HTML Fallback Request URL: {d.htmlFallbackRequestUrl}
            </li>
          ) : null}
          {d.htmlFallbackResponseStatus != null ? (
            <li>HTML Fallback Response Status: {d.htmlFallbackResponseStatus}</li>
          ) : null}
          {d.htmlFallbackSuccessful && d.htmlFallbackTeamsFound != null ? (
            <li>Teams gefunden: {d.htmlFallbackTeamsFound}</li>
          ) : null}
          {d.htmlFallbackSuccessful && d.htmlFallbackMatchesFound != null ? (
            <li>Spiele gefunden: {d.htmlFallbackMatchesFound}</li>
          ) : null}
          {d.htmlFallbackAttempted && d.htmlFallbackError ? (
            <li className="break-words text-amber-100/85">
              HTML-Fallback Fehler: {d.htmlFallbackError}
            </li>
          ) : null}
          {d.htmlFallbackException ? <HtmlFallbackExceptionDetails exception={d.htmlFallbackException} /> : null}
          {d.tournamentName ? <li>Turniername (HTML): {d.tournamentName}</li> : null}
          {d.serverException ? (
            <li className="break-words text-amber-100/85">
              Server-Exception: {d.serverException.name} — {d.serverException.message}
            </li>
          ) : null}
          {d.fetchRuntime ? (
            <>
              <li>Runtime: {d.fetchRuntime.vercel ? 'Vercel' : 'lokal'}</li>
              <li>
                Vercel Region:{' '}
                <span className="font-mono text-[11px] text-white/80">
                  {d.fetchRuntime.region ?? '—'}
                </span>
              </li>
              <li>
                Node Version:{' '}
                <span className="font-mono text-[11px] text-white/80">
                  {d.fetchRuntime.nodeVersion ?? '—'}
                </span>
              </li>
            </>
          ) : null}
        </ul>
      ) : null}

      {endpointAttempts.length > 0 ? (
        <details className="mt-2 text-[11px] text-white/55">
          <summary className="cursor-pointer touch-manipulation">
            Versuchte JSON-Endpoints ({endpointAttempts.length})
          </summary>
          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
            {endpointAttempts.map((attempt) => (
              <li key={attempt.endpoint} className="break-all font-mono text-[10px] leading-snug">
                <span className="text-white/75">{attempt.endpoint}</span>
                <span className="text-white/45"> → {formatEndpointAttemptSummary(attempt)}</span>
                {attempt.finalUrl && attempt.finalUrl !== attempt.endpoint ? (
                  <div className="text-white/40">final URL: {attempt.finalUrl}</div>
                ) : null}
                {attempt.httpStatus != null ? (
                  <div className="text-white/40">status: {attempt.httpStatus}</div>
                ) : null}
                {attempt.exceptionName ? (
                  <div className="text-white/40">
                    exception: {attempt.exceptionName}
                    {attempt.exceptionMessage ? ` — ${attempt.exceptionMessage}` : ''}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-3 text-[12px] leading-snug text-white/65">{TOURNAMENT_IMPORT_MANUAL_HINT}</p>
    </div>
  );
};
