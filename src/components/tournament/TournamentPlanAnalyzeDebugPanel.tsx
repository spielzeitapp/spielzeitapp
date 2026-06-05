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

export const TournamentPlanAnalyzeDebugPanel: React.FC<Props> = ({ failure, diagnostics }) => {
  const d = failure?.diagnostics ?? diagnostics;
  if (!d && !failure) return null;

  const endpointAttempts =
    d?.endpointAttempts ??
    (d?.attemptedEndpoints ?? []).map((endpoint) => ({
      endpoint,
      httpStatus: null,
      networkError: false,
      errorDetail: null,
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
          <li>Browser-Fallback versucht: {yesNo(Boolean(d.browserFallbackAttempted))}</li>
          {d.browserFallbackAttempted && d.browserFallbackError ? (
            <li className="break-words text-amber-100/85">
              Browser-Fallback Fehler: {d.browserFallbackError}
            </li>
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
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-3 text-[12px] leading-snug text-white/65">{TOURNAMENT_IMPORT_MANUAL_HINT}</p>
    </div>
  );
};
