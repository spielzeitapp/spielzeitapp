import React, { useState } from 'react';
import { Users } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatFullLocation, formatLocationTwoLines, splitCombinedLocation } from '../../lib/eventLocation';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import { getClubLogoUrl, isValidLogoUrl } from '../../utils/logoResolver';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatHeroDateParts,
  formatTimeHHmmDe,
  scheduleEventTypeLabel,
  scheduleLocationLine,
  eventNotesTitle,
  eventTrainingEndDisplay,
} from './scheduleEventViewUtils';
import { EventMotifIcon, TrainingMotifIcon } from './scheduleFootballMotifIcons';

export type ScheduleHeroEventCardProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  scoreHome?: number | null;
  scoreAway?: number | null;
  showMeetup: boolean;
  topRight?: React.ReactNode;
  /** @deprecated Nicht mehr in der Hero-Karte gerendert (Trainer-Zeile liegt außerhalb). Prop bleibt für Aufrufer-Kompatibilität. */
  trainerToolbar?: React.ReactNode;
  isPublicView: boolean;
  isClickable: boolean;
  onNavigate?: (eventId: string) => void;
};

function parseNotesParts(ev: EventRow) {
  const noteParts = (ev.notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const endRaw = noteParts.find((p) => p.toLowerCase().startsWith('ende:'));
  const endTimeLabel = endRaw
    ? endRaw.replace(/^ende:\s*/i, '').replace(/\s*uhr\s*$/i, '').trim() || null
    : null;
  const descriptionParts = noteParts.slice(1).filter((p) => !p.toLowerCase().startsWith('ende:'));
  const descriptionText = descriptionParts.length ? descriptionParts.join(' · ') : null;
  return { endTimeLabel, descriptionText };
}

function logoForDisplayName(displayName: string, optionalUrl?: string | null): string {
  if (isValidLogoUrl(optionalUrl)) return optionalUrl!.trim();
  return getClubLogoUrl(displayName);
}

const stadiumBgUrl = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

function HeroTeamLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/55 text-2xl leading-none sm:h-20 sm:w-20 sm:text-[2.5rem]"
        aria-hidden
      >
        ⚽
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20"
      onError={() => setFailed(true)}
    />
  );
}

const heroStadiumGradient = 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(120,0,0,0.85))';

function HeroStadiumBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      <img
        src={stadiumBgUrl}
        alt=""
        className="absolute inset-0 h-full min-h-full w-full min-w-full object-cover object-center opacity-[0.28]"
        aria-hidden
      />
      <div
        className="absolute inset-0 backdrop-blur-[5px] bg-black/15"
        aria-hidden
      />
      <div className="absolute inset-0" style={{ background: heroStadiumGradient }} aria-hidden />
    </div>
  );
}

export function ScheduleHeroEventCard({
  ev,
  et,
  ourTeamName: _ourTeamName,
  opponentLogoUrl,
  scoreHome,
  scoreAway,
  showMeetup,
  topRight,
  trainerToolbar,
  isPublicView,
  isClickable,
  onNavigate,
}: ScheduleHeroEventCardProps) {
  void _ourTeamName;
  void trainerToolbar;
  const ourClubName = getOurTeamDisplayName();
  const { wd, day, mon } = formatHeroDateParts(ev.starts_at);
  const timeStr = formatTimeHHmmDe(ev.starts_at);
  const meetupTimeOnly = formatMeetupTimeOnlyDe(ev.meeting_at);
  const trainingTitle = eventNotesTitle(ev.notes) ?? 'Training';
  const endDisplay = eventTrainingEndDisplay(ev.notes);

  const parsedLoc = splitCombinedLocation(ev.location ?? '');
  const addrExtra = (ev as { address?: string | null }).address ?? null;
  const { line1: locLine1, line2: locLine2 } = formatLocationTwoLines(parsedLoc.place, parsedLoc.address || addrExtra);
  const locSingle = scheduleLocationLine(ev);
  const locationForKickoff =
    formatFullLocation(parsedLoc.place, parsedLoc.address || addrExtra) || null;

  const { endTimeLabel: gameEndLabel, descriptionText: gameDescription } = parseNotesParts(ev);

  const statusHasScore = ev.status === 'live' || ev.status === 'finished';
  const showScore = statusHasScore && (scoreHome != null || scoreAway != null);
  const home = Number(scoreHome ?? 0);
  const away = Number(scoreAway ?? 0);

  const opp = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  let leftName: string;
  let rightName: string;
  let leftOppLogo: string | null;
  let rightOppLogo: string | null;
  if (ev.is_home === true) {
    leftName = ourClubName;
    rightName = opp;
    leftOppLogo = null;
    rightOppLogo = opponentLogoUrl ?? null;
  } else if (ev.is_home === false) {
    leftName = opp;
    rightName = ourClubName;
    leftOppLogo = opponentLogoUrl ?? null;
    rightOppLogo = null;
  } else {
    leftName = ourClubName;
    rightName = opp;
    leftOppLogo = null;
    rightOppLogo = opponentLogoUrl ?? null;
  }

  const leftLogoSrc = logoForDisplayName(leftName, leftOppLogo);
  const rightLogoSrc = logoForDisplayName(rightName, rightOppLogo);

  const matchTypeLabel = getMatchTypeLabel(ev.match_type);
  const kickoffHeaderLabel = showScore && ev.status === 'finished' ? 'ENDSTAND' : 'ANPFIFF';

  const handleCardClick = () => {
    if (!isPublicView && isClickable && onNavigate) onNavigate(ev.id);
  };

  const dateBlock = (
    <div className="pointer-events-none absolute left-0 top-0 z-[2] flex max-w-[42%] flex-col items-start text-left sm:max-w-[38%]">
      <span className="text-[8px] font-black leading-none text-red-400 sm:text-[9px]">{wd}</span>
      <span className="mt-0.5 text-lg font-black tabular-nums leading-none text-white sm:text-xl">{day}</span>
      <span className="mt-0.5 text-[8px] font-bold uppercase leading-tight text-white/50 sm:text-[9px]">{mon}</span>
    </div>
  );

  const statusCluster = topRight ? (
    <div className="pointer-events-none absolute right-0 top-0 z-[2] flex max-w-[10.5rem] flex-col items-end sm:max-w-[11rem]">
      <div className="pointer-events-auto origin-top-right scale-[0.88]">{topRight}</div>
    </div>
  ) : null;

  const gameBody = (
    <>
      <HeroStadiumBackdrop />
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-2 pb-5 pt-5">
        {matchTypeLabel ? (
          <p className="mb-2 line-clamp-2 max-w-[min(100%,20rem)] text-center text-[10px] font-bold uppercase leading-snug tracking-[0.22em] text-white/90 sm:max-w-[24rem] sm:text-[11px] sm:tracking-[0.26em]">
            {matchTypeLabel}
          </p>
        ) : (
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-white/55 sm:text-[11px]">
            Spiel
          </p>
        )}

        <div className="grid w-full min-w-0 max-w-[min(100%,24rem)] grid-cols-[1fr_auto_1fr] items-end gap-x-4 sm:gap-x-8">
          <div className="flex min-w-0 flex-col items-center">
            <HeroTeamLogo src={leftLogoSrc} />
            <p className="mt-1 max-w-full truncate px-0.5 text-center text-xs font-medium text-white/80 sm:mt-2 sm:text-sm">
              {leftName}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-end self-end pb-0.5 sm:pb-1">
            <span
              className="-translate-y-0.5 text-4xl font-bold uppercase leading-none tracking-widest text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.35)] sm:-translate-y-1"
              aria-hidden
            >
              vs
            </span>
          </div>
          <div className="flex min-w-0 flex-col items-center">
            <HeroTeamLogo src={rightLogoSrc} />
            <p className="mt-1 max-w-full truncate px-0.5 text-center text-xs font-medium text-white/80 sm:mt-2 sm:text-sm">
              {rightName}
            </p>
          </div>
        </div>

        <div className="mt-2 flex w-full min-w-0 flex-col items-center px-1 sm:mt-3">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">
            {kickoffHeaderLabel}
          </span>
          <p className="mt-2 flex max-w-full flex-nowrap items-baseline justify-center gap-x-1.5 text-center text-5xl font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] sm:mt-4 sm:text-6xl">
            <span>{showScore ? `${home} : ${away}` : timeStr}</span>
            {!showScore ? (
              <span className="text-[10px] font-medium normal-case tracking-normal text-white/40">Uhr</span>
            ) : null}
          </p>

          {locLine1 || locLine2 ? (
            <div className="mt-1 max-w-[min(100%,20rem)] space-y-0.5 text-center sm:mt-2">
              {locLine1 ? (
                <p className="line-clamp-2 text-sm font-medium leading-snug text-white/55">
                  {locLine1}
                </p>
              ) : null}
              {locLine2 ? (
                <p className="line-clamp-2 text-sm font-normal leading-snug text-white/45">
                  {locLine2}
                </p>
              ) : null}
            </div>
          ) : locationForKickoff ? (
            <p className="mt-1 max-w-[min(100%,20rem)] px-1 text-center text-sm font-normal leading-snug text-white/50 sm:mt-2">
              {locationForKickoff}
            </p>
          ) : null}

          {showMeetup && meetupTimeOnly ? (
            <div
              role="presentation"
              className="mt-2 flex w-full max-w-[min(100%,22rem)] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-red-500 py-2.5 px-5 text-sm font-semibold text-white shadow-lg shadow-red-900/40 sm:mt-3 sm:py-3 sm:px-6 sm:text-base"
            >
              <Users className="h-3.5 w-3.5 shrink-0 opacity-95 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
              <span>Treffpunkt: {meetupTimeOnly}</span>
            </div>
          ) : null}
          {gameEndLabel ? (
            <div className="mt-2 flex min-h-8 w-full max-w-xs items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 text-[11px] font-semibold text-white/88">
              Ende: {gameEndLabel}
            </div>
          ) : null}
          {gameDescription ? (
            <p className="mt-1 line-clamp-2 max-w-xs text-center text-[10px] font-medium leading-snug text-white/45">
              {gameDescription}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );

  const trainingMainTitle =
    trainingTitle.trim() && trainingTitle.trim().toLowerCase() !== 'training'
      ? trainingTitle.trim()
      : 'Training';

  const trainingBody = (
    <>
      <HeroStadiumBackdrop />
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-2 pb-5 pt-5">
        <TrainingMotifIcon className="h-11 w-11 shrink-0 text-red-300/95 sm:h-14 sm:w-14" />
        <h3 className="mt-2 max-w-[min(100%,18rem)] text-center text-lg font-semibold leading-snug text-white sm:mt-3 sm:text-xl">
          {trainingMainTitle}
        </h3>

        <div className="mt-3 flex w-full min-w-0 flex-col items-center px-1 sm:mt-4">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">Beginn</span>
          <p className="mt-2 flex max-w-full flex-nowrap items-baseline justify-center gap-x-1.5 text-center text-5xl font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] sm:mt-4 sm:text-6xl">
            <span>{timeStr}</span>
            <span className="text-[10px] font-medium normal-case tracking-normal text-white/40">Uhr</span>
          </p>

          {locLine1 || locLine2 ? (
            <div className="mt-1 max-w-[min(100%,20rem)] space-y-0.5 text-center sm:mt-2">
              {locLine1 ? (
                <p className="line-clamp-2 text-sm font-medium leading-snug text-white/55">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="line-clamp-2 text-sm font-normal leading-snug text-white/45">{locLine2}</p>
              ) : null}
            </div>
          ) : locSingle ? (
            <p className="mt-1 max-w-[min(100%,20rem)] text-center text-sm font-normal leading-snug text-white/50 sm:mt-2">
              {locSingle}
            </p>
          ) : null}

          {showMeetup && meetupTimeOnly ? (
            <div
              role="presentation"
              className="mt-2 flex w-full max-w-[min(100%,22rem)] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-red-500 py-2.5 px-5 text-sm font-semibold text-white shadow-lg shadow-red-900/40 sm:mt-3 sm:py-3 sm:px-6 sm:text-base"
            >
              <Users className="h-3.5 w-3.5 shrink-0 opacity-95 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
              <span>Treffpunkt: {meetupTimeOnly}</span>
            </div>
          ) : null}
          {endDisplay ? (
            <div className="mt-2 flex min-h-8 w-full max-w-xs items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 text-[11px] font-medium text-white/88">
              <span className="whitespace-nowrap">Ende: {endDisplay}</span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  const eventBody = (
    <>
      <HeroStadiumBackdrop />
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-2 pb-5 pt-5">
        <EventMotifIcon className="h-11 w-11 shrink-0 text-red-300/95 sm:h-14 sm:w-14" />
        <h3 className="mt-2 max-w-[min(100%,18rem)] text-center text-lg font-semibold leading-snug text-white sm:mt-3 sm:text-xl">
          {scheduleEventTypeLabel(ev, et)}
        </h3>

        <div className="mt-3 flex w-full min-w-0 flex-col items-center px-1 sm:mt-4">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">Beginn</span>
          <p className="mt-2 flex max-w-full flex-nowrap items-baseline justify-center gap-x-1.5 text-center text-5xl font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] sm:mt-4 sm:text-6xl">
            <span>{timeStr}</span>
            <span className="text-[10px] font-medium normal-case tracking-normal text-white/40">Uhr</span>
          </p>

          {locLine1 || locLine2 ? (
            <div className="mt-1 max-w-[min(100%,20rem)] space-y-0.5 text-center sm:mt-2">
              {locLine1 ? (
                <p className="line-clamp-2 text-sm font-medium leading-snug text-white/55">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="line-clamp-2 text-sm font-normal leading-snug text-white/45">{locLine2}</p>
              ) : null}
            </div>
          ) : locSingle ? (
            <p className="mt-1 max-w-[min(100%,20rem)] text-center text-sm font-normal leading-snug text-white/50 sm:mt-2">
              {locSingle}
            </p>
          ) : null}

          {showMeetup && meetupTimeOnly ? (
            <div
              role="presentation"
              className="mt-2 flex w-full max-w-[min(100%,22rem)] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-red-500 py-2.5 px-5 text-sm font-semibold text-white shadow-lg shadow-red-900/40 sm:mt-3 sm:py-3 sm:px-6 sm:text-base"
            >
              <Users className="h-3.5 w-3.5 shrink-0 opacity-95 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
              <span>Treffpunkt: {meetupTimeOnly}</span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  const body = et === 'game' ? gameBody : et === 'training' ? trainingBody : eventBody;

  const shell = (
    <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden">
      {body}
    </div>
  );

  if (isPublicView) {
    return (
      <div className="h-full w-full" onClick={(e) => e.preventDefault()}>
        {shell}
      </div>
    );
  }

  if (isClickable && onNavigate) {
    return (
      <div
        role="button"
        tabIndex={0}
        className="h-full w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {shell}
      </div>
    );
  }

  return <div className="h-full w-full">{shell}</div>;
}
