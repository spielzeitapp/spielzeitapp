import React from 'react';
import { ChevronRight, FileDown, Plus } from 'lucide-react';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { sortTournamentMatchSlots } from '../../lib/tournamentPlan';
import { dsPrimaryCtaClass, dsScheduleGlassButtonClass } from '../../lib/premiumDesignSystem';
import { TournamentMatchSlotCard } from './TournamentMatchSlotCard';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL, type TournamentCenterTabId } from './tournamentCenterStyles';

type Props = {
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  canManage?: boolean;
  nextMatchId?: string | null;
  hasOfficialPlanUrl?: boolean;
  onOpenMatch: (matchId: string) => void;
  onShowAll?: (tab: TournamentCenterTabId) => void;
  onAddMatch?: () => void;
  onImportPlan?: () => void;
  maxItems?: number;
};

export function TournamentSchedulePreviewSection({
  slots,
  loading = false,
  canManage = false,
  nextMatchId = null,
  hasOfficialPlanUrl = false,
  onOpenMatch,
  onShowAll,
  onAddMatch,
  onImportPlan,
  maxItems = 4,
}: Props) {
  const sorted = sortTournamentMatchSlots(slots).slice(0, maxItems);

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className={TC_SECTION_LABEL}>Spielplan</p>
          {slots.length > maxItems && onShowAll ? (
            <button
              type="button"
              onClick={() => onShowAll('games')}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-300/80 touch-manipulation"
            >
              Alle
              <ChevronRight className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-[12px] text-white/50">Lade Spielplan…</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] text-white/50">Noch keine Turnierspiele geplant.</p>
            {canManage ? (
              <div className="flex flex-col gap-1 sm:flex-row">
                {onAddMatch ? (
                  <button
                    type="button"
                    className={`inline-flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-full px-3 text-[11px] font-semibold touch-manipulation ${dsPrimaryCtaClass()}`}
                    onClick={onAddMatch}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    Turnierspiel hinzufügen
                  </button>
                ) : null}
                {onImportPlan ? (
                  <button
                    type="button"
                    className={`inline-flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-full px-3 text-[11px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
                    onClick={onImportPlan}
                  >
                    <FileDown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    {hasOfficialPlanUrl ? 'Plan importieren' : 'Plan verknüpfen'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {sorted.map((slot) => (
              <li key={slot.id}>
                <TournamentMatchSlotCard
                  slot={slot}
                  canManage={canManage}
                  compact
                  isNextUpcoming={slot.id === nextMatchId}
                  onOpen={() => {
                    if (slot.match_id) onOpenMatch(slot.match_id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
