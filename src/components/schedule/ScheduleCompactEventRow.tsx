import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getClubLogo } from '../../lib/teamLogos';
import { splitCombinedLocation, formatLocationTwoLines } from '../../lib/eventLocation';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatCompactListDateParts,
  formatTimeHHmmDe,
  scheduleCompactPrimaryTitle,
  scheduleEventTypeLabel,
  eventNotesTitle,
} from './scheduleEventViewUtils';
import { CompactFootballBallIcon, EventMotifIcon } from './scheduleFootballMotifIcons';

export type ScheduleCompactEventRowProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  forcePublicView: boolean;
  trailing?: React.ReactNode;
  onNavigate: (id: string) => void;
};

function CompactOpponentLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-[3.625rem] w-[3.625rem] shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/50 text-[1.85rem] leading-none sm:h-16 sm:w-16 sm:text-[2rem]"
        aria-hidden
      >
        ⚽
      </div>
    );
  }
  return (
    <div className="flex h-[3.625rem] w-[3.625rem] shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/40 sm:h-16 sm:w-16">
      <img
        src={src}
        alt=""
        className="h-[3.125rem] w-[3.125rem] object-contain sm:h-14 sm:w-14"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function eventTypeBadgeClass(et: EffectiveEventType): string {
  if (et === 'training') {
    return 'border-emerald-500/35 bg-emerald-950/45 text-emerald-100';
  }
  if (et === 'game') {
    return 'border-white/18 bg-white/[0.09] text-white/82';
  }
  return 'border-white/16 bg-white/[0.07] text-white/75';
}

export function ScheduleCompactEventRow({
  ev,
  et,
  ourTeamName,
  opponentLogoUrl,
  trailing,
  forcePublicView,
  onNavigate,
}: ScheduleCompactEventRowProps) {
  const { wd, day, monYear } = formatCompactListDateParts(ev.starts_at);
  const timeStr = formatTimeHHmmDe(ev.starts_at);
  const title = scheduleCompactPrimaryTitle(ev, et, ourTeamName);
  const trainingNotesTitle = eventNotesTitle(ev.notes);

  const parsedLoc = splitCombinedLocation(ev.location ?? '');
  const addrExtra = (ev as { address?: string | null }).address ?? null;
  const { line1: locLine1, line2: locLine2 } = formatLocationTwoLines(
    parsedLoc.place,
    parsedLoc.address || addrExtra,
  );

  const clickable = !forcePublicView;
  const handleRowClick = () => {
    if (clickable) onNavigate(ev.id);
  };

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });

  const homeAwayBadge =
    et === 'game' && ev.is_home === true
      ? { label: 'Heim', cls: 'border-emerald-500/45 bg-emerald-950/50 text-emerald-100' }
      : et === 'game' && ev.is_home === false
        ? { label: 'Auswärts', cls: 'border-amber-500/45 bg-amber-950/45 text-amber-100' }
        : null;

  const matchTypeUpper = (getMatchTypeLabel(ev.match_type) ?? 'Spiel').toUpperCase();

  const typeBadgeLabel =
    et === 'game'
      ? matchTypeUpper
      : et === 'training'
        ? 'TRAINING'
        : (scheduleEventTypeLabel(ev, et) ?? 'Termin').toUpperCase();

  const iconSlot =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <div className="flex h-[3.625rem] w-[3.625rem] shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-950/35 sm:h-16 sm:w-16">
        <CompactFootballBallIcon className="h-11 w-11 sm:h-12 sm:w-12" />
      </div>
    ) : (
      <div className="flex h-[3.625rem] w-[3.625rem] shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] sm:h-16 sm:w-16">
        <EventMotifIcon className="h-9 w-9 text-red-200/90 sm:h-10 sm:w-10" />
      </div>
    );

  return (
    <div className="w-full min-w-0">
      <div
        className={[
          'flex min-h-[5.75rem] min-w-0 items-stretch gap-2 rounded-xl px-2 py-2.5 sm:min-h-[6rem] sm:gap-2.5 sm:px-2.5 sm:py-3',
          clickable ? 'cursor-pointer active:bg-white/[0.05]' : 'cursor-default',
        ].join(' ')}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handleRowClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick();
                }
              }
            : undefined
        }
      >
        {/* Spalte Datum — ca. 86px, rot trennen */}
        <div className="flex w-[5.375rem] shrink-0 flex-col justify-center border-r border-red-500/35 pr-2 text-left">
          <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-red-300/95 sm:text-[10px]">
            {wd}
          </span>
          <span className="mt-0.5 text-4xl font-black tabular-nums leading-none tracking-tight text-white drop-shadow-sm sm:text-[2.5rem]">
            {day}
          </span>
          <span className="mt-0.5 text-[9px] font-bold uppercase leading-snug text-white/80 sm:text-[10px]">
            {monYear}
          </span>
          <span className="mt-1 text-[11px] font-bold tabular-nums text-red-300/95 sm:text-xs">{timeStr}</span>
        </div>

        {/* Logo — ca. 76px */}
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center">{iconSlot}</div>

        {/* Inhalt */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5 pr-1">
          <span
            className={`inline-flex w-fit max-w-full rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase leading-snug tracking-[0.12em] sm:text-[9px] sm:tracking-[0.14em] ${eventTypeBadgeClass(et)} line-clamp-2`}
          >
            {typeBadgeLabel}
          </span>

          {et === 'game' ? (
            <>
              <div className="flex min-w-0 items-start gap-1.5">
                <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-white break-words line-clamp-2 sm:text-[14px]">
                  {oppName}
                </p>
                {homeAwayBadge ? (
                  <span
                    className={`mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide sm:text-[10px] ${homeAwayBadge.cls}`}
                  >
                    {homeAwayBadge.label}
                  </span>
                ) : null}
              </div>
              {locLine1 ? (
                <p className="text-[12px] font-semibold leading-snug text-white/88 sm:text-[13px]">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="text-[10px] font-normal leading-snug text-white/45 sm:text-[11px]">{locLine2}</p>
              ) : null}
            </>
          ) : et === 'training' ? (
            <>
              <p className="text-[13px] font-bold leading-snug text-white sm:text-[14px]">Training</p>
              {trainingNotesTitle && trainingNotesTitle.trim().toLowerCase() !== 'training' ? (
                <p className="line-clamp-2 min-w-0 text-[11px] leading-snug text-white/55 sm:text-[12px]">
                  {trainingNotesTitle}
                </p>
              ) : null}
              {locLine1 ? (
                <p className="text-[12px] font-semibold leading-snug text-white/88 sm:text-[13px]">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="text-[10px] font-normal leading-snug text-white/45 sm:text-[11px]">{locLine2}</p>
              ) : null}
            </>
          ) : (
            <>
              <p className="line-clamp-2 min-w-0 text-[13px] font-bold leading-snug text-white break-words sm:text-[14px]">
                {title}
              </p>
              {locLine1 ? (
                <p className="text-[12px] font-semibold leading-snug text-white/88 sm:text-[13px]">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="text-[10px] font-normal leading-snug text-white/45 sm:text-[11px]">{locLine2}</p>
              ) : null}
            </>
          )}
        </div>

        {/* Stats + Pfeil */}
        <div className="flex shrink-0 items-center gap-1 self-stretch pl-0.5">
          <div className="flex min-w-0 flex-col items-end justify-center gap-1">{trailing}</div>
          {clickable ? (
            <ChevronRight
              className="h-5 w-5 shrink-0 self-center text-white/35 sm:h-5 sm:w-5"
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
