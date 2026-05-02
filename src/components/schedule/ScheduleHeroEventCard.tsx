import React, { useState } from 'react';
import type { EventRow } from '../../hooks/useEvents';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatLocationTwoLines, splitCombinedLocation } from '../../lib/eventLocation';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatHeroDateParts,
  formatTimeHHmmDe,
  gameTeamNames,
  scheduleEventTypeLabel,
  scheduleLocationLine,
  eventNotesTitle,
  eventTrainingEndDisplay,
} from './scheduleEventViewUtils';
import { EventMotifIcon, MatchFallbackMotifIcon, TrainingMotifIcon } from './scheduleFootballMotifIcons';

export type ScheduleHeroEventCardProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  scoreHome?: number | null;
  scoreAway?: number | null;
  showMeetup: boolean;
  topRight?: React.ReactNode;
  isPublicView: boolean;
  isClickable: boolean;
  onNavigate?: (eventId: string) => void;
};

export function ScheduleHeroEventCard({
  ev,
  et,
  ourTeamName,
  opponentLogoUrl,
  scoreHome,
  scoreAway,
  showMeetup,
  topRight,
  isPublicView,
  isClickable,
  onNavigate,
}: ScheduleHeroEventCardProps) {
  const displayOur = ourTeamName?.trim() || getOurTeamDisplayName();
  const { wd, day, mon } = formatHeroDateParts(ev.starts_at);
  const timeStr = formatTimeHHmmDe(ev.starts_at);
  const { left: leftTeam, right: rightTeam } = gameTeamNames(ev, et, displayOur);
  const meetup = formatMeetupTimeOnlyDe(ev.meeting_at);
  const trainingTitle = eventNotesTitle(ev.notes) ?? 'Training';
  const endDisplay = eventTrainingEndDisplay(ev.notes);

  const parsedLoc = splitCombinedLocation(ev.location ?? '');
  const addrExtra = (ev as { address?: string | null }).address ?? null;
  const { line1: locLine1, line2: locLine2 } = formatLocationTwoLines(parsedLoc.place, parsedLoc.address || addrExtra);
  const locSingle = scheduleLocationLine(ev);

  const hasScore =
    et === 'game' &&
    (ev.status === 'live' || ev.status === 'finished') &&
    (scoreHome != null || scoreAway != null);
  const home = Number(scoreHome ?? 0);
  const away = Number(scoreAway ?? 0);

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  const oppResolvedLogo = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });
  const ourResolvedLogo = getClubLogo(displayOur);
  const leftLogoUrl = ev.is_home === false ? oppResolvedLogo : ourResolvedLogo;
  const rightLogoUrl = ev.is_home === false ? ourResolvedLogo : oppResolvedLogo;

  const [leftBroke, setLeftBroke] = useState(false);
  const [rightBroke, setRightBroke] = useState(false);

  const handleCardClick = () => {
    if (!isPublicView && isClickable && onNavigate) onNavigate(ev.id);
  };

  const cardClass = [
    'relative w-full overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-b from-zinc-950/95 via-black/92 to-red-950/25 px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_48px_rgba(220,38,38,0.14)] sm:px-3 sm:py-3.5',
    !isPublicView && isClickable ? 'cursor-pointer transition hover:border-red-500/50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const matchTypeLabel = getMatchTypeLabel(ev.match_type) ?? 'Spiel';
  const kickLabel =
    et === 'game' && hasScore && ev.status === 'finished'
      ? 'ENDSTAND'
      : et === 'game' && ev.status === 'live'
        ? 'LIVE'
        : et === 'game'
          ? 'ANPFIFF'
          : 'BEGINN';

  const logoImg = (src: string, side: 'L' | 'R', broken: boolean, setBroken: (v: boolean) => void) => (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-2xl border border-red-500/30 bg-black/50 shadow-[0_0_20px_rgba(220,38,38,0.2)] sm:h-14 sm:w-14">
        {!broken ? (
          <img
            src={src}
            alt=""
            className="h-full w-full rounded-2xl object-contain p-0.5"
            onError={() => setBroken(true)}
          />
        ) : (
          <MatchFallbackMotifIcon className="h-9 w-9 text-red-400/90 sm:h-10 sm:w-10" />
        )}
      </div>
    </div>
  );

  const gameBlock = (
    <>
      <p className="line-clamp-2 px-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white/55 sm:text-[11px]">
        {matchTypeLabel}
      </p>
      <p className="mt-0.5 text-center text-[10px] font-black uppercase tracking-[0.28em] text-red-300/95">{kickLabel}</p>
      <p className="mt-1 text-center text-[clamp(1.55rem,7.5vw,2.35rem)] font-black tabular-nums leading-none tracking-tight text-white">
        {timeStr}
      </p>
      <div className="mt-2 flex items-start justify-center gap-3 sm:mt-2.5 sm:gap-5">
        {logoImg(leftLogoUrl, leftBroke, setLeftBroke)}
        {logoImg(rightLogoUrl, rightBroke, setRightBroke)}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5 text-[11px] font-bold leading-tight text-white sm:text-xs">
        <span className="min-w-0 flex-1 truncate text-center">{leftTeam}</span>
        <span className="shrink-0 text-[10px] font-black text-white/30">·</span>
        <span className="min-w-0 flex-1 truncate text-center">{rightTeam}</span>
      </div>
      {hasScore ? (
        <p className="mt-1 text-center text-base font-black tabular-nums text-red-200/95 sm:text-lg">
          {home}:{away}
        </p>
      ) : null}
      <div className="mt-2 space-y-0.5 px-0.5 text-center">
        {locLine1 ? (
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white/70 sm:text-xs">{locLine1}</p>
        ) : null}
        {locLine2 && locLine2.toLowerCase() !== (locLine1 ?? '').toLowerCase() ? (
          <p className="line-clamp-2 text-[10px] leading-snug text-white/50 sm:text-[11px]">{locLine2}</p>
        ) : !locLine1 && locSingle ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-white/65">{locSingle}</p>
        ) : null}
      </div>
    </>
  );

  const trainingBlock = (
    <>
      <div className="flex items-center justify-center gap-2">
        <TrainingMotifIcon className="h-7 w-7 shrink-0 text-red-300/95 sm:h-8 sm:w-8" />
        <span className="text-center text-sm font-black uppercase tracking-wide text-white">{trainingTitle}</span>
      </div>
      <p className="mt-1 text-center text-[10px] font-black uppercase tracking-[0.28em] text-red-300/95">BEGINN</p>
      <p className="mt-1 text-center text-[clamp(1.55rem,7.5vw,2.35rem)] font-black tabular-nums leading-none text-white">
        {timeStr}
      </p>
      <div className="mt-2 space-y-0.5 px-0.5 text-center">
        {locLine1 ? (
          <p className="line-clamp-2 text-[11px] font-semibold text-white/70">{locLine1}</p>
        ) : locSingle ? (
          <p className="line-clamp-2 text-[11px] text-white/65">{locSingle}</p>
        ) : (
          <p className="text-[11px] text-white/35">Ort folgt</p>
        )}
        {locLine2 && locLine2.toLowerCase() !== (locLine1 ?? '').toLowerCase() ? (
          <p className="line-clamp-2 text-[10px] text-white/50">{locLine2}</p>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {showMeetup && meetup ? (
          <span className="inline-flex max-w-full truncate rounded-full border border-red-500/40 bg-red-950/50 px-2.5 py-1 text-[10px] font-semibold text-red-100 sm:text-[11px]">
            Treffpunkt: {meetup}
          </span>
        ) : null}
        {endDisplay ? (
          <span className="inline-flex max-w-full truncate rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 sm:text-[11px]">
            Ende: {endDisplay}
          </span>
        ) : null}
      </div>
    </>
  );

  const eventBlock = (
    <>
      <div className="flex items-center justify-center gap-2">
        <EventMotifIcon className="h-7 w-7 text-red-300/95" />
        <span className="line-clamp-2 text-center text-sm font-bold text-white">{scheduleEventTypeLabel(ev, et)}</span>
      </div>
      <p className="mt-1 text-center text-[10px] font-black uppercase tracking-[0.22em] text-red-300/90">BEGINN</p>
      <p className="mt-1 text-center text-[clamp(1.55rem,7.5vw,2.35rem)] font-black tabular-nums text-white">{timeStr}</p>
      <div className="mt-2 px-0.5 text-center">
        {locSingle ? (
          <p className="line-clamp-3 text-[11px] text-white/65">{locSingle}</p>
        ) : (
          <p className="text-[11px] text-white/35">Ort folgt</p>
        )}
      </div>
      {showMeetup && meetup ? (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex max-w-full truncate rounded-full border border-red-500/40 bg-red-950/50 px-2.5 py-1 text-[10px] font-semibold text-red-100">
            Treffpunkt: {meetup}
          </span>
        </div>
      ) : null}
    </>
  );

  const inner = (
    <>
      {topRight ? (
        <div className="pointer-events-none absolute right-1.5 top-1.5 z-[2] max-w-[9.5rem] sm:right-2 sm:top-2 sm:max-w-[10.5rem]">
          <div className="pointer-events-auto">{topRight}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-[auto_1fr] gap-2 sm:gap-3">
        <div className="flex w-[2.65rem] shrink-0 flex-col items-center border-r border-white/10 pr-2 text-center sm:w-11">
          <span className="text-[8px] font-black leading-none text-red-300/95 sm:text-[9px]">{wd}</span>
          <span className="mt-0.5 text-xl font-black tabular-nums leading-none text-white sm:text-2xl">{day}</span>
          <span className="mt-0.5 text-[8px] font-bold uppercase leading-tight text-white/50 sm:text-[9px]">{mon}</span>
        </div>

        <div className="relative min-w-0 pr-1 sm:pr-2">
          {et === 'game' ? gameBlock : et === 'training' ? trainingBlock : eventBlock}

          {et === 'game' && showMeetup && meetup ? (
            <div className="mt-2 flex justify-center">
              <span className="inline-flex max-w-full truncate rounded-full border border-red-500/40 bg-red-950/50 px-2.5 py-1 text-[10px] font-semibold text-red-100 sm:text-[11px]">
                Treffpunkt: {meetup}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  if (isPublicView) {
    return (
      <div className={cardClass} onClick={(e) => e.preventDefault()}>
        {inner}
      </div>
    );
  }

  if (isClickable && onNavigate) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cardClass}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {inner}
      </div>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}
