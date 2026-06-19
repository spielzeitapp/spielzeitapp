import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  formatTournamentKickoffTime,
  isTournamentSlotPreparable,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { tournamentPhaseDisplayLabel } from '../../lib/matchCenterTournamentVisuals';
import { safeOptionalText } from '../../lib/safeText';
import { TournamentPrepareButton } from './TournamentNextMatchWorkflowCta';

type Props = {
  slot: TournamentMatchSlotView;
  canManage?: boolean;
  isNextUpcoming?: boolean;
  compact?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
};

function statusChipTone(
  status: ReturnType<typeof tournamentMatchDisplayStatus>,
): 'selected' | 'present' | 'open' | 'neutral' {
  if (status.kind === 'live') return 'selected';
  if (status.kind === 'result') return 'present';
  if (status.kind === 'preparation') return 'open';
  return 'neutral';
}

function statusLabel(
  slot: TournamentMatchSlotView,
  status: ReturnType<typeof tournamentMatchDisplayStatus>,
): string {
  if (status.kind === 'live') return 'Live';
  if (status.kind === 'result') return 'Beendet';
  if (status.kind === 'preparation') return 'Vorbereitung';
  const phase = tournamentPhaseDisplayLabel(slot.phase, slot.group_label);
  return phase !== 'Turnierspiel' ? phase : 'Geplant';
}

export function TournamentMatchSlotCard({
  slot,
  canManage = false,
  isNextUpcoming = false,
  compact = false,
  onOpen,
  onDelete,
}: Props) {
  const status = tournamentMatchDisplayStatus(slot);
  const timeLabel = formatTournamentKickoffTime(slot.kickoff_at);
  const pitch = safeOptionalText(slot.pitch);
  const scoreLine =
    status.kind === 'result' ? `${status.ourGoals}:${status.oppGoals}` : null;
  const label = statusLabel(slot, status);
  const showPrepare =
    canManage && isNextUpcoming && isTournamentSlotPreparable(slot);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition ${
        isNextUpcoming
          ? 'border-[rgba(255,71,71,0.32)] bg-[rgba(255,71,71,0.06)] shadow-[0_0_20px_rgba(255,71,71,0.08)]'
          : 'border-white/[0.08] bg-white/[0.03]'
      }`}
    >
      {isNextUpcoming ? (
        <span className="absolute left-3 top-2 z-[1] text-[9px] font-bold uppercase tracking-[0.12em] text-red-200/90">
          Nächstes Spiel
        </span>
      ) : null}
      {canManage && onDelete ? (
        <button
          type="button"
          className="absolute right-2 top-2 z-[3] rounded-full p-1.5 text-white/40 hover:bg-red-500/15 hover:text-red-400 touch-manipulation"
          aria-label={`${slot.opponent_name} entfernen`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ) : null}
      <div
        className={`relative flex w-full flex-col gap-2 ${
          compact ? 'px-3 py-2.5' : 'px-3 py-3'
        } ${isNextUpcoming ? 'pt-7' : ''} ${canManage ? 'pr-10' : 'pr-3'}`}
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full flex-col gap-1.5 text-left touch-manipulation"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium tabular-nums text-white/55">{timeLabel} Uhr</p>
              {scoreLine ? (
                <p className="mt-0.5 text-[18px] font-bold leading-tight text-white">
                  <span className="tabular-nums">{scoreLine}</span>
                  <span className="mx-1.5 text-[14px] font-medium text-white/55">vs</span>
                  <span className="break-words">{slot.opponent_name}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-[16px] font-bold leading-snug text-white break-words">
                  {slot.opponent_name}
                </p>
              )}
              {pitch ? <p className="mt-0.5 text-[11px] text-white/45">{pitch}</p> : null}
            </div>
            <span className={`shrink-0 ${dsStatusChipClass(statusChipTone(status))}`}>{label}</span>
          </div>
        </button>

        {showPrepare ? <TournamentPrepareButton matchId={slot.match_id} /> : null}
      </div>
    </div>
  );
}
