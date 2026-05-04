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
  /** Eltern/Spieler „Weitere Termine“: 3 Spalten (Datum | Text | Button+Pfeil), ohne Logos. */
  parentCompactLayout?: boolean;
  trailing?: React.ReactNode;
  onNavigate: (id: string) => void;
};

function navIconUrl(file: string): string {
  const b = import.meta.env.BASE_URL || '/';
  const base = b.endsWith('/') ? b : `${b}/`;
  return `${base}icons/${file}`;
}

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

/** Kurzform für Zeile 2 (z. B. „Meisterschaft“ statt „Meisterschaftsspiel“). */
function shortMatchTypeLabel(matchType: string | null | undefined): string {
  const f = getMatchTypeLabel(matchType) ?? 'Spiel';
  if (/^Meisterschaftsspiel$/i.test(f)) return 'Meisterschaft';
  if (/^Freundschaftsspiel$/i.test(f)) return 'Freundschaft';
  if (/^Testspiel$/i.test(f)) return 'Test';
  return f;
}

function CompactOpponentLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[1rem] leading-none" aria-hidden>
        ⚽
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-8 w-8 shrink-0 object-contain"
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
 * „Weitere Termine“: Datum | Content (Icon+Text) | Aktion+Pfeil.
 * Eltern: rechte Spalte fix w-[118px]; Trainer: gleiche Spalte für Stats.
 */
export function CompactEventCard({
  ev,
  et,
  ourTeamName,
  opponentLogoUrl,
  parentCompactLayout = false,
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

  const homeAwayShort =
    et === 'game' && ev.is_home === true ? 'Heim' : et === 'game' && ev.is_home === false ? 'Auswärts' : '';

  const trainingTitle =
    et === 'training' ? (compactTrainingHeadline(ourTeamName, trainingNotesTitle) ?? 'Training') : null;

  if (parentCompactLayout) {
    const parentTitle = et === 'game' ? oppName : et === 'training' ? trainingTitle : title;

    let parentSubline: string | null = null;
    if (et === 'game') {
      const parts = [homeAwayShort, venueOnly].filter(Boolean);
      parentSubline = parts.length ? parts.join(' • ') : null;
    } else if (venueOnly) {
      parentSubline = venueOnly;
    }

    return (
      <div
        className={[
          'mb-3 flex min-h-[96px] w-full min-w-0 flex-row items-stretch gap-3 overflow-hidden rounded-2xl border border-red-950/45 bg-zinc-950 px-2.5 py-3',
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
        <div className="flex w-[60px] shrink-0 flex-col items-start justify-center gap-0 leading-none">
          <span className="text-[10px] font-medium uppercase leading-tight tracking-wide text-red-300">{wd}</span>
          <span className="text-[30px] font-bold tabular-nums leading-none text-white">{day}</span>
          <span className="text-[10px] leading-tight text-gray-400">{monYear}</span>
          <span className="text-[13px] font-medium tabular-nums leading-tight text-red-400">{timeStr}</span>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
          <p
            className="min-w-0 whitespace-normal text-[15px] font-semibold leading-tight text-white [overflow-wrap:normal] [word-break:normal] line-clamp-2"
            lang="de"
          >
            {parentTitle}
          </p>
          {parentSubline ? (
            <p
              className="mt-1 min-w-0 whitespace-normal text-[12px] leading-snug text-gray-400 line-clamp-2 [overflow-wrap:normal] [word-break:normal]"
              lang="de"
              title={parentSubline}
            >
              {parentSubline}
            </p>
          ) : null}
        </div>

        <div className="flex w-[96px] shrink-0 flex-col items-end justify-between self-stretch py-0.5">
          <div className="flex shrink-0 flex-col items-end">{trailing}</div>
          <div className="flex w-3 shrink-0 items-center justify-end">
            {clickable ? (
              <ChevronRight className="h-3 w-3 shrink-0 text-white opacity-60" strokeWidth={2} aria-hidden />
            ) : (
              <span className="block h-3 w-3 shrink-0" aria-hidden />
            )}
          </div>
        </div>
      </div>
    );
  }

  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });

  const matchShort = shortMatchTypeLabel(ev.match_type);
  const gameSubtitle =
    et === 'game' ? (homeAwayShort ? `${homeAwayShort} · ${matchShort}` : matchShort) : null;

  const typeBadgeLabelOther =
    et !== 'game' && et !== 'training'
      ? (scheduleEventTypeLabel(ev, et) ?? 'Termin').toUpperCase()
      : null;

  const iconSlot =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <img
        src={navIconUrl('home-ball.png')}
        alt=""
        className="h-8 w-8 shrink-0 object-contain opacity-95 [filter:drop-shadow(0_0_4px_rgba(255,90,90,0.1))]"
        decoding="async"
        draggable={false}
      />
    ) : (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <EventMotifIcon className="h-6 w-6 text-red-200/85" />
      </span>
    );

  const titleClamp =
    'line-clamp-2 min-w-0 whitespace-normal text-[15px] font-bold leading-tight text-white [overflow-wrap:normal] [word-break:normal]';

  const titleText = (
    <div className="min-w-0 flex-1">
      {et === 'game' ? (
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
      )}
    </div>
  );

  const line2 =
    et === 'game' && gameSubtitle ? (
      <p className="line-clamp-1 min-w-0 pl-[calc(2rem+0.375rem)] text-xs font-medium leading-snug text-white/55" lang="de">
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
      <p className="flex min-h-0 min-w-0 max-w-full items-center gap-1 pl-[calc(2rem+0.375rem)] text-[13px] font-medium leading-snug text-white/85">
        <MapPin className="h-3 w-3 shrink-0 text-rose-300/70" aria-hidden />
        <span className="min-w-0 flex-1 truncate" title={venueOnly}>
          {venueOnly}
        </span>
      </p>
    ) : null;

  return (
    <div
      className={[
        'mb-3 flex w-full min-w-0 flex-row items-start justify-between gap-2 overflow-x-hidden rounded-2xl border border-red-950/45 bg-zinc-950 px-2.5 py-3',
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
        <span className="text-[34px] font-bold tabular-nums leading-none text-white">{day}</span>
        <span className="text-xs font-medium leading-tight text-white/65">{monYear}</span>
        <span className="text-sm font-semibold tabular-nums leading-tight text-red-500">{timeStr}</span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-start gap-1.5">
          <div className="shrink-0 pt-0.5">{iconSlot}</div>
          {titleText}
        </div>
        {line2}
        {line3}
      </div>

      <div className="flex w-[118px] shrink-0 flex-row items-start justify-end gap-1 pt-0.5">
        {trailing ? <div className="min-w-0 shrink">{trailing}</div> : null}
        <div className="flex w-3.5 shrink-0 items-center justify-center pt-1">
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
