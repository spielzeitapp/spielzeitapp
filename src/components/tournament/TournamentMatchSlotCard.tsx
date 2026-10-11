import React from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import {
  formatTournamentKickoffTime,
  isOwnPlayableTournamentSlot,
  isTournamentSlotPreparable,
  tournamentMatchDisplayStatus,
  tournamentSlotScoreDisplay,
  type TournamentMatchSlotView,
} from '../../lib/tournamentPlan';
import { tournamentPhaseDisplayLabel } from '../../lib/matchCenterTournamentVisuals';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { TournamentPrepareButton } from './TournamentNextMatchWorkflowCta';
import { TournamentClubLogo } from './TournamentClubLogo';
import { formatVisibleClubName } from '../../lib/oefbTeamNameNormalize';

type Props = {
  slot: TournamentMatchSlotView;
  canManage?: boolean;
  isNextUpcoming?: boolean;
  compact?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
};

function resultBadge(slot: TournamentMatchSlotView): { label: string; className: string } {
  const status = tournamentMatchDisplayStatus(slot);
  if (status.kind === 'live') {
    return { label: 'Live', className: 'animate-pulse border-red-500/40 bg-red-500/15 text-red-200' };
  }
  if (status.kind === 'result' && isOwnPlayableTournamentSlot(slot)) {
    if (status.ourGoals > status.oppGoals) {
      return { label: 'Sieg', className: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200' };
    }
    if (status.ourGoals === status.oppGoals) {
      return { label: 'Remis', className: 'border-amber-500/35 bg-amber-500/12 text-amber-100' };
    }
    return { label: 'Niederlage', className: 'border-red-500/35 bg-red-500/12 text-red-200' };
  }
  return {
    label: status.kind === 'result' ? 'Beendet' : status.kind === 'preparation' ? 'Vorbereitung' : 'Geplant',
    className: 'border-white/15 bg-white/[0.06] text-white/70',
  };
}

function TournamentTeamBlock({ name }: { name: string }) {
  const visible = formatVisibleClubName(name) || 'Team';
  const parts = visible.split(/\s+/);
  const prefix = parts.length > 1 && /^[A-ZÄÖÜ0-9.]{2,8}$/.test(parts[0]) ? parts.shift() : null;
  return (
    <div className="flex min-w-0 max-w-full flex-col items-center justify-start text-center">
      <TournamentClubLogo name={name} size="md" tone="dark" className="!h-12 !w-12 sm:!h-14 sm:!w-14 [&_img]:!max-h-12 [&_img]:!max-w-12 sm:[&_img]:!max-h-14 sm:[&_img]:!max-w-14" />
      {prefix ? <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">{prefix}</div> : null}
      <p className="mt-0.5 w-full min-w-0 text-center text-[13px] font-semibold leading-tight text-white [overflow-wrap:anywhere] [text-wrap:balance] sm:text-[14px]">
        {parts.join(' ')}
      </p>
    </div>
  );
}

function slotSideNames(slot: TournamentMatchSlotView): { home: string; away: string } {
  const home = safeText(slot.home_team);
  const away = safeText(slot.away_team);
  if (home && away) return { home, away };
  const opponent = safeText(slot.opponent_name) || 'Gegner';
  if (isOwnPlayableTournamentSlot(slot)) {
    return { home: getOurTeamDisplayName(), away: opponent };
  }
  return { home: opponent, away: opponent };
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
  const isOwn = isOwnPlayableTournamentSlot(slot);
  const scoreLine = tournamentSlotScoreDisplay(slot);
  const badge = resultBadge(slot);
  const phaseLabel = tournamentPhaseDisplayLabel(slot.phase, slot.group_label);
  const showPrepare =
    canManage && isNextUpcoming && isOwn && isTournamentSlotPreparable(slot) && Boolean(slot.match_id);
  const clickable = isOwn && Boolean(slot.match_id);
  const sides = slotSideNames(slot);

  return (
    <div
      className={`sz-club-surface sz-club-surface--hero relative w-full min-w-0 overflow-hidden rounded-[22px] border outline-none backdrop-blur-sm ${
        isNextUpcoming ? 'ring-1 ring-red-400/30 shadow-[0_0_20px_rgba(255,71,71,0.08)]' : ''
      }`}
    >
      <div className="sz-club-page-hero-glow pointer-events-none absolute inset-0 opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(106,16,20,0.18),transparent_70%)]" />
      <div className={`relative px-3.5 sm:px-4 ${compact ? 'py-2.5' : 'py-3'}`}>
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12px] font-semibold tabular-nums text-white/70">{timeLabel} Uhr</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-red-200/80">
              {isNextUpcoming ? 'Nächstes Spiel' : isOwn ? 'Eigenes Spiel' : 'Turnierspiel'}
            </span>
          </div>
          {canManage && onDelete ? (
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-white/40 hover:bg-red-500/15 hover:text-red-400 touch-manipulation"
              aria-label={`${sides.home} gegen ${sides.away} entfernen`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpen}
          disabled={!clickable}
          aria-label={`${sides.home} gegen ${sides.away}, ${scoreLine || timeLabel + ' Uhr'}, ${badge.label}`}
          className="sz-club-focus block w-full min-w-0 rounded-lg text-left touch-manipulation disabled:cursor-default"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 border-t border-white/[0.07] pt-3">
            <TournamentTeamBlock name={sides.home} />
            <div className="flex min-w-0 flex-col items-center justify-start px-0.5">
              <span className={`text-[12px] font-bold uppercase tracking-[0.16em] ${status.kind === 'live' ? 'text-red-300' : 'sz-club-icon'}`}>
                {status.kind === 'result' ? 'Endstand' : status.kind === 'live' ? 'Live' : 'Anpfiff'}
              </span>
              <span className={`mt-1 text-center font-extrabold leading-none tracking-tight text-white tabular-nums ${scoreLine ? 'text-[2.65rem] sm:text-[2.9rem]' : 'text-[1.65rem] sm:text-[1.9rem]'}`}>
                {scoreLine || timeLabel}
              </span>
              <span className={`mt-1 inline-flex max-w-[7.5rem] rounded-full border px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-wider ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <TournamentTeamBlock name={sides.away} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2">
            <div className="min-w-0 flex-1">
              {pitch ? <p className="text-[12px] leading-snug text-white/50">{pitch}</p> : null}
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">{phaseLabel}</p>
            </div>
            {clickable ? (
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-white/45">
                Zum Spiel <ChevronRight className="sz-club-icon h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
            ) : null}
          </div>
        </button>
        {showPrepare && slot.match_id ? (
          <div className="mt-3"><TournamentPrepareButton matchId={slot.match_id} /></div>
        ) : null}
      </div>
    </div>
  );
}
