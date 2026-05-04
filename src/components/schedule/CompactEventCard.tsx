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

export type CompactEventCardProps = {
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
        className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-white/12 bg-black/60 text-[1.75rem] leading-none"
        aria-hidden
      >
        ⚽
      </div>
    );
  }
  return (
    <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-white/12 bg-black/45">
      <img
        src={src}
        alt=""
        className="h-[54px] w-[54px] object-contain"
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

/**
 * „Weitere Termine“: eine horizontale Kartenzeile (Datum | Logo | Inhalt | Stats | Pfeil).
 */
export function CompactEventCard({
  ev,
  et,
  ourTeamName,
  opponentLogoUrl,
  trailing,
  forcePublicView,
  onNavigate,
}: CompactEventCardProps) {
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
      <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-950/40">
        <CompactFootballBallIcon className="h-[54px] w-[54px] text-white/95" />
      </div>
    ) : (
      <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06]">
        <EventMotifIcon className="h-9 w-9 text-red-200/90" />
      </div>
    );

  const titleClamp =
    'line-clamp-2 whitespace-normal text-lg font-bold leading-snug text-white [overflow-wrap:normal] [word-break:normal]';

  const titleBlock =
    et === 'game' ? (
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-0">
        <p className={`min-w-0 flex-1 sm:min-w-[8rem] ${titleClamp}`}>{oppName}</p>
        {homeAwayBadge ? (
          <span
            className={`inline-flex w-fit shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${homeAwayBadge.cls}`}
          >
            {homeAwayBadge.label}
          </span>
        ) : null}
      </div>
    ) : et === 'training' ? (
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className={titleClamp}>Training</p>
        {trainingNotesTitle && trainingNotesTitle.trim().toLowerCase() !== 'training' ? (
          <p className="line-clamp-2 whitespace-normal text-xs leading-snug text-white/55 [overflow-wrap:normal] [word-break:normal]">
            {trainingNotesTitle}
          </p>
        ) : null}
      </div>
    ) : (
      <p className={`min-w-0 ${titleClamp}`}>{title}</p>
    );

  return (
    <div
      className={[
        'mb-3 flex min-h-[104px] w-full min-w-0 flex-row items-center gap-2 overflow-visible rounded-2xl border border-red-950/45 bg-zinc-950 px-3 py-3',
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
      <div className="flex w-[70px] shrink-0 flex-col gap-0.5 text-left leading-none">
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-rose-300/90">{wd}</span>
        <span className="text-[36px] font-bold tabular-nums leading-none text-white">{day}</span>
        <span className="text-xs font-medium leading-tight text-white/65">{monYear}</span>
        <span className="text-sm font-semibold tabular-nums leading-tight text-red-500">{timeStr}</span>
      </div>

      <div className="flex w-[58px] shrink-0 items-center justify-center">{iconSlot}</div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1">
        <span
          className={`inline-flex w-fit max-w-full rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase leading-tight tracking-wide ${eventTypeBadgeClass(et)}`}
        >
          {typeBadgeLabel}
        </span>
        {titleBlock}
        {locLine1 ? (
          <p className="flex min-h-0 min-w-0 items-center gap-1 text-[13px] font-medium leading-tight text-white/85">
            <MapPin className="h-3 w-3 shrink-0 text-rose-300/70" aria-hidden />
            <span className="line-clamp-1 min-w-0 whitespace-normal [overflow-wrap:normal] [word-break:normal]">
              {locLine1}
            </span>
          </p>
        ) : null}
        {locLine2 ? (
          <p className="min-w-0 truncate text-[11px] font-normal leading-tight text-white/45" title={locLine2}>
            {locLine2}
          </p>
        ) : null}
      </div>

      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 self-stretch">
        {trailing ?? null}
      </div>

      <div className="flex w-4 shrink-0 items-center justify-center self-stretch">
        {clickable ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/45" strokeWidth={2} aria-hidden />
        ) : (
          <span className="block h-4 w-4 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  );
}
