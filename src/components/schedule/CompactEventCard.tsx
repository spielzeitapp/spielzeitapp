import React, { useState } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getClubLogo } from '../../lib/teamLogos';
import { splitCombinedLocation } from '../../lib/eventLocation';
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

function navIconUrl(file: string): string {
  const b = import.meta.env.BASE_URL || '/';
  const base = b.endsWith('/') ? b : `${b}/`;
  return `${base}icons/${file}`;
}

/** „U11 Training“ aus Teamname/Notes; sonst null → Anzeige „Training“. */
function compactTrainingHeadline(ourTeamName: string, notesTitle: string | null): string | null {
  const team = (ourTeamName ?? '').trim();
  let m = team.match(/\bU\s*(\d{1,2})\b/i);
  if (m) return `U${m[1]} Training`;
  m = team.match(/\bU(\d{1,2})\b/i);
  if (m) return `U${m[1]} Training`;
  const n = (notesTitle ?? '').trim();
  if (n && n.toLowerCase() !== 'training') return n;
  return null;
}

function CompactOpponentLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[1.1rem] leading-none" aria-hidden>
        ⚽
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-9 w-9 shrink-0 object-contain"
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

/**
 * „Weitere Termine“: links Datum+Icon, Mitte Text (Training ohne Badge; Spiel mit Untertitel), rechts Aktion+Pfeil.
 * Trainer: `trailing` = Stats; Eltern: nur Status-Button (keine Zahlen).
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
  const venueOnly = (parsedLoc.place ?? '').trim() || null;

  const clickable = !forcePublicView;
  const handleRowClick = () => {
    if (clickable) onNavigate(ev.id);
  };

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });

  const matchTypeLabel = getMatchTypeLabel(ev.match_type) ?? 'Spiel';
  const homeAwayPart =
    et === 'game' && ev.is_home === true ? 'HEIM' : et === 'game' && ev.is_home === false ? 'AUSWÄRTS' : '';
  const gameSubtitle =
    et === 'game' ? (homeAwayPart ? `${homeAwayPart} • ${matchTypeLabel}` : matchTypeLabel) : null;

  const typeBadgeLabelOther =
    et !== 'game' && et !== 'training'
      ? (scheduleEventTypeLabel(ev, et) ?? 'Termin').toUpperCase()
      : null;

  const trainingTitle =
    et === 'training' ? (compactTrainingHeadline(ourTeamName, trainingNotesTitle) ?? 'Training') : null;

  const iconSlot =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <img
        src={navIconUrl('home-ball.png')}
        alt=""
        className="h-9 w-9 shrink-0 object-contain opacity-95 [filter:drop-shadow(0_0_5px_rgba(255,90,90,0.12))]"
        decoding="async"
        draggable={false}
      />
    ) : (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <EventMotifIcon className="h-7 w-7 text-red-200/85" />
      </span>
    );

  const titleClamp =
    'line-clamp-2 min-w-0 max-w-full whitespace-normal text-[15px] font-bold leading-tight text-white [overflow-wrap:normal] [word-break:normal]';

  const line1 =
    et === 'game' ? (
      <p className={titleClamp} lang="de">
        {oppName}
      </p>
    ) : et === 'training' ? (
      <p className={titleClamp} lang="de">
        {trainingTitle}
      </p>
    ) : (
      <p className={titleClamp} lang="de">
        {title}
      </p>
    );

  const line2 =
    et === 'game' && gameSubtitle ? (
      <p className="line-clamp-1 min-w-0 text-xs font-semibold uppercase tracking-wide text-white/55" lang="de">
        {gameSubtitle}
      </p>
    ) : et !== 'game' && et !== 'training' && typeBadgeLabelOther ? (
      <span
        className={`inline-flex w-fit max-w-full shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${eventTypeBadgeClass(et)}`}
      >
        {typeBadgeLabelOther}
      </span>
    ) : null;

  const line3 =
    venueOnly ? (
      <p className="flex min-h-0 min-w-0 max-w-full items-center gap-1 text-[13px] font-medium leading-snug text-white/85">
        <MapPin className="h-3 w-3 shrink-0 text-rose-300/70" aria-hidden />
        <span className="min-w-0 flex-1 truncate" title={venueOnly}>
          {venueOnly}
        </span>
      </p>
    ) : null;

  return (
    <div
      className={[
        'mb-3 flex w-full min-w-0 flex-row items-center justify-between gap-1 overflow-x-hidden rounded-2xl border border-red-950/45 bg-zinc-950 px-2.5 py-3',
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
      <div className="flex shrink-0 flex-row items-center gap-0.5">
        <div className="flex w-[70px] shrink-0 flex-col gap-0.5 text-left leading-none">
          <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-rose-300/90">{wd}</span>
          <span className="text-[34px] font-bold tabular-nums leading-none text-white">{day}</span>
          <span className="text-xs font-medium leading-tight text-white/65">{monYear}</span>
          <span className="text-sm font-semibold tabular-nums leading-tight text-red-500">{timeStr}</span>
        </div>
        <div className="flex w-9 shrink-0 items-center justify-center">{iconSlot}</div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 self-center px-1">
        {line1}
        {line2}
        {line3}
      </div>

      <div className="flex shrink-0 flex-row items-center gap-1">
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
        <div className="flex w-[14px] shrink-0 items-center justify-center">
          {clickable ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/45" strokeWidth={2} aria-hidden />
          ) : (
            <span className="block h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}
