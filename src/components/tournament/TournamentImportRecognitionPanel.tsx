import React from 'react';
import { AppButton } from '../ui/AppButton';
import type { TournamentImportRecognition } from '../../lib/tournamentPlanImport';

type Props = {
  recognition: TournamentImportRecognition | null;
  ownMatchCount: number;
  onAddAlias: () => void;
};

export const TournamentImportRecognitionPanel: React.FC<Props> = ({
  recognition,
  ownMatchCount,
  onAddAlias,
}) => {
  if (!recognition) return null;

  if (ownMatchCount > 0) {
    return (
      <p className="text-[12px] text-emerald-300/85">
        {ownMatchCount === 1
          ? '1 Spiel unserer Mannschaft erkannt.'
          : `${ownMatchCount} Spiele unserer Mannschaft erkannt.`}
      </p>
    );
  }

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-3 text-[13px] text-amber-100/90"
      role="alert"
    >
      <p className="font-medium">Keine Spiele unserer Mannschaft erkannt.</p>
      <p className="mt-2 text-[12px] text-amber-100/75">Verwendete Namen:</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-[12px] text-white/70">
        {recognition.teamSeasonName ? (
          <li>
            Team-Saison: <span className="text-white/90">{recognition.teamSeasonName}</span>
          </li>
        ) : null}
        {recognition.teamName ? (
          <li>
            Team: <span className="text-white/90">{recognition.teamName}</span>
          </li>
        ) : null}
        {recognition.aliases.length > 0 ? (
          <li>
            Aliase ({recognition.aliases.length}):{' '}
            <span className="text-white/90">{recognition.aliases.join(', ')}</span>
          </li>
        ) : (
          <li>Keine Aliase hinterlegt</li>
        )}
      </ul>
      <AppButton variant="secondary" className="mt-3 w-full" onClick={onAddAlias}>
        Alias hinzufügen
      </AppButton>
    </div>
  );
};
