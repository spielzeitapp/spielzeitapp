import React from 'react';
import {
  formatTournamentKickoffTime,
  isOwnPlayableTournamentSlot,
  tournamentSlotDisplayTitle,
  tournamentSlotScoreDisplay,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import { pickLastFinishedTournamentSlots } from './tournamentCenterUtils';

type Props = {
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  onOpen: (matchId: string) => void;
};

export function TournamentLastResultsCard({ slots, loading = false, onOpen }: Props) {
  const results = pickLastFinishedTournamentSlots(slots, 8);

  if (loading) return null;
  if (results.length === 0) return null;

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        <p className={TC_SECTION_LABEL}>Letzte Ergebnisse</p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {results.map((slot) => {
            const scoreLine = tournamentSlotScoreDisplay(slot);
            if (!scoreLine) return null;
            const title = tournamentSlotDisplayTitle(slot);
            const clickable = isOwnPlayableTournamentSlot(slot);
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (slot.match_id) onOpen(slot.match_id);
                  }}
                  disabled={!clickable}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left touch-manipulation ${
                    clickable
                      ? 'border-[rgba(255,71,71,0.16)] bg-[rgba(255,71,71,0.04)] hover:border-[rgba(255,71,71,0.28)]'
                      : 'border-white/[0.06] bg-white/[0.03] disabled:hover:border-white/[0.06]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-white">{title}</p>
                    <p className="text-[11px] tabular-nums text-white/50">
                      {formatTournamentKickoffTime(slot.kickoff_at)} Uhr
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[17px] font-bold tabular-nums text-white">{scoreLine}</span>
                    <span className={dsStatusChipClass('present')}>Beendet</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
