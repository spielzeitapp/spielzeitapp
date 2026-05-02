import React, { useState } from 'react';
import type { EventRow } from '../../hooks/useEvents';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatFullLocation, formatLocationTwoLines, splitCombinedLocation } from '../../lib/eventLocation';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import { MatchCardKickoffBlock } from '../match/MatchCardGameCore';
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
  /** Trainer: Live / Bearbeiten / Löschen / Kalender — oben rechts, neben Status */
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

function HeroTeamLogo({ src }: { src: string }) {
  const [phase, setPhase] = useState<'img' | 'shield' | 'ball'>('img');
  if (phase === 'ball') {
    return (
      <div
        className="flex h-[4.5rem] w-[4.5rem] max-w-[22vw] shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/55 text-[2.75rem] leading-none sm:h-20 sm:w-20 sm:max-w-none"
        aria-hidden
      >
        ⚽
      </div>
    );
  }
  const url = phase === 'shield' ? '/logos/placeholder-shield-a.png' : src;
  return (
    <img
      src={url}
      alt=""
      className="h-[4.5rem] w-[4.5rem] max-w-[22vw] shrink-0 object-contain sm:h-20 sm:w-20 sm:max-w-none"
      onError={() => {
        if (phase === 'img') setPhase('shield');
        else setPhase('ball');
      }}
    />
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

  const statusCluster =
    topRight || trainerToolbar ? (
      <div className="pointer-events-none absolute right-0 top-0 z-[2] flex max-w-[min(52%,13.5rem)] flex-col items-end gap-1.5 sm:max-w-[14rem]">
        {topRight ? <div className="pointer-events-auto">{topRight}</div> : null}
        {trainerToolbar ? (
          <div className="pointer-events-auto flex flex-row flex-wrap justify-end gap-1">{trainerToolbar}</div>
        ) : null}
      </div>
    ) : null;

  const gameBody = (
    <>
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-0.5 pt-10 sm:pt-11">
        {matchTypeLabel ? (
          <p className="mb-3 line-clamp-2 max-w-[min(100%,20rem)] text-center text-[11px] font-bold uppercase leading-snug tracking-[0.2em] text-red-100/95 sm:mb-4 sm:max-w-[24rem] sm:text-xs sm:tracking-[0.24em]">
            {matchTypeLabel}
          </p>
        ) : (
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-white/55 sm:mb-4 sm:text-[11px]">
            Spiel
          </p>
        )}

        <div className="grid w-full min-w-0 max-w-[22rem] grid-cols-[1fr_auto_1fr] items-end gap-x-1.5 sm:max-w-[26rem] sm:gap-x-3">
          <div className="flex min-w-0 flex-col items-center gap-2 border-r border-white/10 pr-1 sm:pr-3">
            <HeroTeamLogo src={leftLogoSrc} />
            <p className="line-clamp-3 w-full max-w-[10.5rem] text-center text-[11px] font-bold leading-snug text-white [overflow-wrap:anywhere] sm:max-w-[12rem] sm:text-[13px]">
              {leftName}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-end px-0.5 pb-1">
            <span
              className="text-3xl font-black uppercase leading-none tracking-[0.06em] text-red-500 drop-shadow-[0_0_24px_rgba(239,68,68,0.4)] sm:text-5xl"
              aria-hidden
            >
              vs
            </span>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 border-l border-white/10 pl-1 sm:pl-3">
            <HeroTeamLogo src={rightLogoSrc} />
            <p className="line-clamp-3 w-full max-w-[10.5rem] text-center text-[11px] font-bold leading-snug text-white [overflow-wrap:anywhere] sm:max-w-[12rem] sm:text-[13px]">
              {rightName}
            </p>
          </div>
        </div>

        <div className="mt-5 flex w-full min-w-0 flex-col items-center px-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.32em] text-red-400/95 sm:text-[10px]">
            {kickoffHeaderLabel}
          </span>
          <p className="mt-1 max-w-full text-center text-[2.5rem] font-black tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)] min-[375px]:text-[2.75rem] sm:text-[3.5rem]">
            {showScore ? `${home} : ${away}` : timeStr}
          </p>
          {!showScore ? <span className="mt-1.5 text-sm font-medium text-white/78">Uhr</span> : null}

          {locLine1 || locLine2 ? (
            <div className="mt-4 max-w-[min(100%,20rem)] space-y-0.5 text-center">
              {locLine1 ? (
                <p className="text-[12px] font-semibold leading-snug text-white/90 [overflow-wrap:anywhere] sm:text-[13px]">
                  {locLine1}
                </p>
              ) : null}
              {locLine2 ? (
                <p className="text-[11px] font-medium leading-snug text-white/60 [overflow-wrap:anywhere] sm:text-[12px]">
                  {locLine2}
                </p>
              ) : null}
            </div>
          ) : locationForKickoff ? (
            <p className="mt-4 max-w-[min(100%,20rem)] px-1 text-center text-[12px] font-medium leading-snug text-white/70 sm:text-[13px]">
              {locationForKickoff}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex w-full min-w-0 flex-col items-center gap-2 px-1">
          {showMeetup && meetupTimeOnly ? (
            <div
              role="presentation"
              className="flex min-h-[2.75rem] w-full max-w-xs items-center justify-center rounded-full border border-red-400/40 bg-red-600/90 px-4 text-[15px] font-semibold text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)] sm:text-base"
            >
              Treffpunkt: {meetupTimeOnly}
            </div>
          ) : null}
          {gameEndLabel ? (
            <div className="flex min-h-9 w-full max-w-xs items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white/88">
              Ende: {gameEndLabel}
            </div>
          ) : null}
          {gameDescription ? (
            <p className="line-clamp-2 max-w-xs text-center text-[11px] font-medium leading-snug text-white/50">
              {gameDescription}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );

  const trainingBody = (
    <>
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-1 pt-10 sm:pt-11">
        <TrainingMotifIcon className="h-8 w-8 shrink-0 text-red-300/95" />
        {trainingTitle.trim() && trainingTitle.trim().toLowerCase() !== 'training' ? (
          <p className="mt-1 line-clamp-2 max-w-[18rem] text-center text-[11px] font-medium text-white/65">
            {trainingTitle}
          </p>
        ) : null}
        <div className="mt-3 w-full min-w-0 max-w-sm">
          <MatchCardKickoffBlock
            timeDisplay={timeStr}
            showUhr
            location={locSingle || null}
            headerLabel="BEGINN"
            subtitleAboveHeader="TRAINING"
            hero
          />
        </div>
        {locLine2 && locLine2.toLowerCase() !== (locLine1 ?? '').toLowerCase() ? (
          <p className="mt-2 line-clamp-2 max-w-[20rem] text-center text-[11px] leading-snug text-white/45">
            {locLine2}
          </p>
        ) : null}
        <div className="mt-5 flex w-full flex-wrap justify-center gap-2 px-1">
          {showMeetup && meetupTimeOnly ? (
            <div className="flex min-h-[2.75rem] max-w-xs flex-1 items-center justify-center rounded-full bg-red-600/90 px-5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
              <span className="whitespace-nowrap">Treffpunkt: {meetupTimeOnly}</span>
            </div>
          ) : null}
          {endDisplay ? (
            <div className="flex min-h-9 max-w-xs flex-1 items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 text-sm font-medium text-white/90">
              <span className="whitespace-nowrap">Ende: {endDisplay}</span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  const eventBody = (
    <>
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-1 pt-10 sm:pt-11">
        <div className="flex items-center gap-2">
          <EventMotifIcon className="h-8 w-8 shrink-0 text-red-300/95" />
          <span className="line-clamp-2 max-w-[min(100%,17rem)] text-center text-sm font-bold text-white">
            {scheduleEventTypeLabel(ev, et)}
          </span>
        </div>
        <div className="mt-3 w-full min-w-0 max-w-sm">
          <MatchCardKickoffBlock
            timeDisplay={timeStr}
            showUhr
            location={locSingle || null}
            headerLabel="BEGINN"
            subtitleAboveHeader={null}
            hero={false}
          />
        </div>
        {showMeetup && meetupTimeOnly ? (
          <div className="mt-4 flex w-full justify-center px-1">
            <span className="inline-flex min-h-[2.75rem] max-w-xs items-center justify-center rounded-full border border-red-400/40 bg-red-600/85 px-5 text-sm font-semibold text-white">
              Treffpunkt: {meetupTimeOnly}
            </span>
          </div>
        ) : null}
      </div>
    </>
  );

  const body = et === 'game' ? gameBody : et === 'training' ? trainingBody : eventBody;

  const shell = (
    <div className="relative h-full min-h-[280px] w-full min-w-0 overflow-hidden sm:min-h-[300px]">
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
