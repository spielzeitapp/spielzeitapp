import React, { useState } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
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
        className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/60 text-[2rem] leading-none"
        aria-hidden
      >
        ⚽
      </div>
    );
  }
  return (
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/45">
      <img
        src={src}
        alt=""
        className="h-[60px] w-[60px] max-h-16 max-w-16 object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function eventTypeBadgeClass(et: EffectiveEventType): string {
  if (et === 'training') {
    return 'border-emerald-500/40 bg-emerald-950/55 text-emerald-100';
  }
  if (et === 'game') {
    return 'border-white/18 bg-white/[0.08] text-white/85';
  }
  return 'border-white/16 bg-white/[0.06] text-white/78';
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
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-950/40">
        <CompactFootballBallIcon className="h-[60px] w-[60px] max-h-16 max-w-16 text-white/95" />
      </div>
    ) : (
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06]">
        <EventMotifIcon className="h-10 w-10 text-red-200/90" />
      </div>
    );

  const gridTemplate = trailing
    ? 'grid-cols-[86px_72px_minmax(0,1fr)_96px_20px]'
    : 'grid-cols-[86px_72px_minmax(0,1fr)_20px]';

  return (
    <div
      className={[
        `grid min-h-[104px] w-full min-w-0 items-start gap-x-2 gap-y-1 ${gridTemplate}`,
        clickable ? 'cursor-pointer active:bg-white/[0.03]' : 'cursor-default',
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
      <div className="flex w-[86px] shrink-0 flex-col gap-0.5 self-start text-left leading-tight">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-300/90">{wd}</span>
        <span className="text-[40px] font-bold tabular-nums leading-[0.95] text-white sm:text-[44px]">{day}</span>
        <span className="text-xs font-medium text-white/60">{monYear}</span>
        <span className="text-sm font-semibold tabular-nums text-rose-400">{timeStr}</span>
      </div>

      <div className="flex w-[72px] shrink-0 items-start justify-center pt-0.5">{iconSlot}</div>

      <div className="flex min-h-0 min-w-0 flex-col gap-1.5 self-start py-0.5 pr-0.5">
        {et === 'game' ? (
          <>
            <span
              className={`inline-flex w-fit max-w-full shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase leading-snug tracking-wide ${eventTypeBadgeClass(et)}`}
            >
              {typeBadgeLabel}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
                <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-white [overflow-wrap:break-word] [word-break:normal] sm:text-[15px]">
                  <span className="line-clamp-2">{oppName}</span>
                </p>
                {homeAwayBadge ? (
                  <span
                    className={`inline-flex w-fit shrink-0 self-start rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${homeAwayBadge.cls}`}
                  >
                    {homeAwayBadge.label}
                  </span>
                ) : null}
              </div>
              {locLine1 ? (
                <p className="flex min-w-0 items-start gap-1.5 text-[13px] font-medium leading-snug text-white/80">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300/70" aria-hidden />
                  <span className="min-w-0 [overflow-wrap:break-word] [word-break:normal]">{locLine1}</span>
                </p>
              ) : null}
              {locLine2 ? (
                <p className="pl-5 text-[11px] font-normal leading-relaxed text-white/45 [overflow-wrap:break-word] [word-break:normal]">
                  {locLine2}
                </p>
              ) : null}
            </div>
          </>
        ) : et === 'training' ? (
          <>
            <span
              className={`inline-flex w-fit max-w-full shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase leading-snug tracking-wide ${eventTypeBadgeClass(et)}`}
            >
              {typeBadgeLabel}
            </span>
            <p className="text-[15px] font-bold leading-snug text-white">Training</p>
            {trainingNotesTitle && trainingNotesTitle.trim().toLowerCase() !== 'training' ? (
              <p className="min-w-0 text-[12px] leading-snug text-white/55 [overflow-wrap:break-word] [word-break:normal]">
                <span className="line-clamp-2">{trainingNotesTitle}</span>
              </p>
            ) : null}
            {locLine1 ? (
              <p className="flex min-w-0 items-start gap-1.5 text-[13px] font-medium leading-snug text-white/80">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300/70" aria-hidden />
                <span className="min-w-0 [overflow-wrap:break-word] [word-break:normal]">{locLine1}</span>
              </p>
            ) : null}
            {locLine2 ? (
              <p className="pl-5 text-[11px] font-normal leading-relaxed text-white/45 [overflow-wrap:break-word] [word-break:normal]">
                {locLine2}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <span
              className={`inline-flex w-fit max-w-full shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase leading-snug tracking-wide ${eventTypeBadgeClass(et)}`}
            >
              {typeBadgeLabel}
            </span>
            <p className="min-w-0 text-[15px] font-bold leading-snug text-white [overflow-wrap:break-word] [word-break:normal]">
              <span className="line-clamp-2">{title}</span>
            </p>
            {locLine1 ? (
              <p className="flex min-w-0 items-start gap-1.5 text-[13px] font-medium leading-snug text-white/80">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300/70" aria-hidden />
                <span className="min-w-0 [overflow-wrap:break-word] [word-break:normal]">{locLine1}</span>
              </p>
            ) : null}
            {locLine2 ? (
              <p className="pl-5 text-[11px] font-normal leading-relaxed text-white/45 [overflow-wrap:break-word] [word-break:normal]">
                {locLine2}
              </p>
            ) : null}
          </>
        )}
      </div>

      {trailing ? (
        <div className="flex min-h-0 w-full min-w-0 shrink-0 flex-col items-end justify-center justify-self-end py-0.5">
          {trailing}
        </div>
      ) : null}

      <div className="flex h-full w-5 shrink-0 items-center justify-center justify-self-end self-stretch">
        {clickable ? (
          <ChevronRight className="h-5 w-5 text-white/45" strokeWidth={2} aria-hidden />
        ) : (
          <span className="block w-5" aria-hidden />
        )}
      </div>
    </div>
  );
}
