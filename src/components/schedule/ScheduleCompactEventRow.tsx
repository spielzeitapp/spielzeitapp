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
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/50 text-[1.75rem] leading-none"
        aria-hidden
      >
        ⚽
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/40">
      <img
        src={src}
        alt=""
        className="h-12 w-12 object-contain"
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
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-950/35">
        <CompactFootballBallIcon className="h-[3.5rem] w-[3.5rem]" />
      </div>
    ) : (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06]">
        <EventMotifIcon className="h-9 w-9 text-red-200/90" />
      </div>
    );

  return (
    <div className="w-full min-w-0">
      <div
        className={[
          'flex min-h-[112px] w-full min-w-0 flex-row items-center gap-3 p-4',
          clickable ? 'cursor-pointer active:bg-white/[0.04]' : 'cursor-default',
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
        <div className="flex w-[78px] shrink-0 flex-col justify-center gap-0.5 text-left">
          <span className="text-xs font-bold uppercase leading-tight tracking-wide text-red-300">{wd}</span>
          <span className="text-4xl font-bold tabular-nums leading-none tracking-tight text-white">{day}</span>
          <span className="text-sm font-medium leading-snug text-white/85">{monYear}</span>
          <span className="text-base font-semibold tabular-nums text-red-300">{timeStr}</span>
        </div>

        <div className="flex w-16 shrink-0 items-center justify-center">{iconSlot}</div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1.5">
          <span
            className={`inline-flex w-fit max-w-full rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase leading-snug tracking-wide ${eventTypeBadgeClass(et)}`}
          >
            {typeBadgeLabel}
          </span>

          {et === 'game' ? (
            <>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="min-w-0 text-[14px] font-bold leading-snug text-white break-words [overflow-wrap:anywhere] line-clamp-2 sm:text-[15px]">
                  {oppName}
                </p>
                {homeAwayBadge ? (
                  <span
                    className={`w-fit rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${homeAwayBadge.cls}`}
                  >
                    {homeAwayBadge.label}
                  </span>
                ) : null}
              </div>
              {locLine1 ? (
                <p className="text-[13px] font-semibold leading-snug text-white/90">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="text-[11px] font-normal leading-relaxed text-white/45">{locLine2}</p>
              ) : null}
            </>
          ) : et === 'training' ? (
            <>
              <p className="text-[14px] font-bold leading-snug text-white sm:text-[15px]">Training</p>
              {trainingNotesTitle && trainingNotesTitle.trim().toLowerCase() !== 'training' ? (
                <p className="line-clamp-2 min-w-0 text-[12px] leading-snug text-white/55">{trainingNotesTitle}</p>
              ) : null}
              {locLine1 ? (
                <p className="text-[13px] font-semibold leading-snug text-white/90">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="text-[11px] font-normal leading-relaxed text-white/45">{locLine2}</p>
              ) : null}
            </>
          ) : (
            <>
              <p className="line-clamp-2 min-w-0 text-[14px] font-bold leading-snug text-white break-words [overflow-wrap:anywhere] sm:text-[15px]">
                {title}
              </p>
              {locLine1 ? (
                <p className="text-[13px] font-semibold leading-snug text-white/90">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="text-[11px] font-normal leading-relaxed text-white/45">{locLine2}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex w-[92px] shrink-0 flex-col items-end justify-center gap-1">{trailing}</div>

        {clickable ? (
          <ChevronRight className="h-5 w-5 shrink-0 text-white/40" strokeWidth={2} aria-hidden />
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  );
}
