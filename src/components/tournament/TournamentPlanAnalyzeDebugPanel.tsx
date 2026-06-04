import React from 'react';
import {
  TOURNAMENT_IMPORT_MANUAL_HINT,
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

export const TournamentPlanAnalyzeDebugPanel: React.FC<Props> = ({ failure, diagnostics }) => {
  const d = failure?.diagnostics ?? diagnostics;
  if (!d && !failure) return null;

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
          <li>API erreichbar: {yesNo(d.apiReachable)}</li>
        </ul>
      ) : null}

      {d && d.attemptedEndpoints.length > 0 ? (
        <details className="mt-2 text-[11px] text-white/55">
          <summary className="cursor-pointer touch-manipulation">Versuchte Datenquellen ({d.attemptedEndpoints.length})</summary>
          <ul className="mt-1 max-h-24 list-inside list-disc overflow-y-auto">
            {d.attemptedEndpoints.map((endpoint) => (
              <li key={endpoint} className="break-all font-mono">
                {endpoint}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-3 text-[12px] leading-snug text-white/65">{TOURNAMENT_IMPORT_MANUAL_HINT}</p>
    </div>
  );
};
