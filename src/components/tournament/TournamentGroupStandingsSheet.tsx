import React from 'react';
import { createPortal } from 'react-dom';
import type { TournamentGroupStandings } from '../../lib/tournamentGroupStandings';
import { formatTournamentGoalDifference } from '../../lib/tournamentPlan';

type Props = {
  isOpen: boolean;
  standings: TournamentGroupStandings | null;
  onClose: () => void;
};

export const TournamentGroupStandingsSheet: React.FC<Props> = ({ isOpen, standings, onClose }) => {
  if (!isOpen || !standings || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modalOverlay !z-[1002]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="modalSheet max-h-[min(92dvh,calc(100dvh-var(--app-header-h)-env(safe-area-inset-top,0px)-12px))] border border-purple-500/25 shadow-[0_0_40px_rgba(88,28,135,0.18)] sm:max-w-[480px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-group-standings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div id="tournament-group-standings-title" className="modalTitle text-white">
            Gruppe {standings.groupLabel}
          </div>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        <div className="modalBody">
          <ul className="flex flex-col gap-2">
            {standings.rows.map((row) => (
              <li
                key={row.teamName}
                className={`rounded-xl border px-3 py-2.5 ${
                  row.isOurTeam
                    ? 'border-emerald-500/35 bg-emerald-950/25'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-white">
                      {row.rank}. {row.teamName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-white/55">
                      {row.played} Sp. · {row.wins}-{row.draws}-{row.losses}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-bold tabular-nums text-white">{row.points} Pkt.</p>
                    <p className="text-[12px] tabular-nums text-white/60">
                      {row.goalsFor}:{row.goalsAgainst} (
                      {formatTournamentGoalDifference(row.goalDifference)})
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
};
