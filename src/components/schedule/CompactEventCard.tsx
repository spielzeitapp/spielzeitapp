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
import { EventMotifIcon } from './scheduleFootballMotifIcons';

export type CompactEventCardProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  forcePublicView: boolean;
  trailing?: React.ReactNode;
  onNavigate: (id: string) => void;
};

/** Gleiche Icon-URL wie BottomNav (`public/icons/home-ball.png`). */
function navIconUrl(file: string): string {
  const b = import.meta.env.BASE_URL || '/';
  const base = b.endsWith('/') ? b : `${b}/`;
  return `${base}icons/${file}`;
}

function CompactOpponentLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center text-[2rem] leading-none" aria-hidden>
        ⚽
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-[50px] w-full max-w-[50px] shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function eventTypeBadgeClass(et: EffectiveEventType): string {
  if (et === 'training') {
    return 'bg-emerald-950/75 text-emerald-100/95';
  }
  if (et === 'game') {
    return 'bg-zinc-800/90 text-white/82';
  }
  return 'bg-zinc-800/80 text-white/78';
}

function homeAwayClass(isHome: boolean): string {
  return isHome
    ? 'bg-emerald-950/65 text-emerald-100'
    : 'bg-amber-950/50 text-amber-100';
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
      ? { label: 'Heim', isHome: true as const }
      : et === 'game' && ev.is_home === false
        ? { label: 'Auswärts', isHome: false as const }
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
      <img
        src={navIconUrl('home-ball.png')}
        alt=""
        className="h-[50px] w-full max-w-[50px] shrink-0 object-contain"
        decoding="async"
        draggable={false}
      />
    ) : (
      <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center">
        <EventMotifIcon className="h-9 w-9 text-red-200/90" />
      </span>
    );

  const titleClamp =
    'line-clamp-2 whitespace-normal text-[15px] font-bold leading-tight text-white [overflow-wrap:normal] [word-break:normal]';

  const titleBlock =
    et === 'game' ? (
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-0">
        <p className={`min-w-0 flex-1 sm:min-w-[6rem] ${titleClamp}`}>{oppName}</p>
        {homeAwayBadge ? (
          <span
            className={`inline-flex w-fit shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${homeAwayClass(homeAwayBadge.isHome)}`}
          >
            {homeAwayBadge.label}
          </span>
        ) : null}
      </div>
    ) : et === 'training' ? (
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className={titleClamp}>Training</p>
        {trainingNotesTitle && trainingNotesTitle.trim().toLowerCase() !== 'training' ? (
          <p className="line-clamp-2 whitespace-normal text-[12px] leading-snug text-white/55 [overflow-wrap:normal] [word-break:normal]">
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
        'mb-3 flex min-h-[104px] w-full min-w-0 flex-row items-start gap-1 overflow-visible rounded-2xl border border-red-950/45 bg-zinc-950 px-2.5 py-3',
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
      <div className="flex w-[62px] shrink-0 flex-col gap-0.5 self-start pt-0.5 text-left leading-none">
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-rose-300/90">{wd}</span>
        <span className="text-[34px] font-bold tabular-nums leading-none text-white">{day}</span>
        <span className="text-xs font-medium leading-tight text-white/65">{monYear}</span>
        <span className="text-sm font-semibold tabular-nums leading-tight text-red-500">{timeStr}</span>
      </div>

      <div className="flex w-[48px] shrink-0 items-start justify-center self-start pt-0.5">{iconSlot}</div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 self-start pt-0.5">
        <span
          className={`inline-flex w-fit max-w-full rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${eventTypeBadgeClass(et)}`}
        >
          {typeBadgeLabel}
        </span>
        {titleBlock}
        {locLine1 ? (
          <p className="flex min-h-0 min-w-0 items-center gap-1 text-[13px] font-medium leading-snug text-white/85">
            <MapPin className="h-3 w-3 shrink-0 text-rose-300/70" aria-hidden />
            <span className="line-clamp-1 min-w-0 whitespace-normal [overflow-wrap:normal] [word-break:normal]">
              {locLine1}
            </span>
          </p>
        ) : null}
        {locLine2 ? (
          <p
            className="min-w-0 truncate text-[12px] font-normal leading-snug text-gray-400"
            title={locLine2}
          >
            {locLine2}
          </p>
        ) : null}
      </div>

      <div className="flex w-[48px] shrink-0 flex-col items-center justify-center gap-0.5 self-center py-0.5">
        {trailing ?? null}
      </div>

      <div className="flex w-[14px] shrink-0 items-center justify-center self-center">
        {clickable ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/45" strokeWidth={2} aria-hidden />
        ) : (
          <span className="block h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  );
}
