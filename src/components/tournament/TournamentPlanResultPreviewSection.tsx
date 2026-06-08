import React from 'react';
import type { TournamentPlanOwnMatchPreview } from '../../lib/tournamentPlanImport';

type Props = {
  matchesWithResult: number;
  matchesWithoutResult: number;
  ownMatches: TournamentPlanOwnMatchPreview[];
};

export const TournamentPlanResultPreviewSection: React.FC<Props> = ({
  matchesWithResult,
  matchesWithoutResult,
  ownMatches,
}) => (
  <div className="flex flex-col gap-2">
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white/85">
      <p>Spiele mit Ergebnis: {matchesWithResult}</p>
      <p>Spiele ohne Ergebnis: {matchesWithoutResult}</p>
    </div>

    {ownMatches.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-medium text-white/75">Eigene Spiele</p>
        <ul className="flex flex-col gap-1 text-[13px] text-white/70">
          {ownMatches.map((match) => (
            <li key={`${match.kickoffTimeHHmm}-${match.opponentName}`}>
              <span className="font-medium text-white/85">{match.opponentName}</span>
              <span className="text-white/50"> · {match.kickoffTimeHHmm} Uhr</span>
              {match.hasResult && match.ourGoals != null && match.oppGoals != null ? (
                <span className="text-emerald-300/90"> · Ergebnis: {match.ourGoals}:{match.oppGoals}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
);
