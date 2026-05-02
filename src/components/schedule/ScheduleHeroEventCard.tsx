import React from 'react';
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

const stadiumBgUrl = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

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

  const baseCard = [
    'relative w-full overflow-hidden rounded-2xl border border-red-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_56px_rgba(220,38,38,0.18)]',
    !isPublicView && isClickable ? 'cursor-pointer transition hover:border-red-500/55' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const statusCluster = topRight || trainerToolbar ? (
    <div className="pointer-events-none absolute right-2 top-2 z-[5] flex max-w-[min(92%,20rem)] flex-col items-end gap-1.5 sm:right-3 sm:top-3">
      {topRight ? <div className="pointer-events-auto">{topRight}</div> : null}
      {trainerToolbar ? <div className="pointer-events-auto flex flex-row flex-wrap justify-end gap-1">{trainerToolbar}</div> : null}
    </div>
  ) : null;

  const gameMatchday = (
    <div
      className="relative flex min-h-[260px] flex-col items-center justify-between bg-zinc-950 px-2 pb-4 pt-10 sm:px-4 sm:pt-11"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(6,2,2,0.88) 0%, rgba(10,4,4,0.82) 45%, rgba(4,10,6,0.9) 100%), url(${stadiumBgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-black/88" aria-hidden />
      {statusCluster}
      <div className="relative z-[1] flex w-full max-w-md flex-col items-center px-1">
        {matchTypeLabel ? (
          <p className="mb-3 line-clamp-2 max-w-[min(100%,20rem)] text-center text-[13px] font-semibold leading-snug text-white/95 sm:mb-4 sm:text-[15px]">
            {matchTypeLabel}
          </p>
        ) : (
          <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-white/55 sm:mb-4">Spiel</p>
        )}

        <div className="grid w-full max-w-[22rem] grid-cols-[1fr_auto_1fr] items-end gap-x-1.5 sm:max-w-[24rem] sm:gap-x-3">
          <div className="flex min-w-0 flex-col items-center gap-2 border-r border-white/10 pr-1.5 sm:pr-3">
            <img
              src={leftLogoSrc}
              alt=""
              className="h-14 w-14 shrink-0 object-contain sm:h-[4.25rem] sm:w-[4.25rem]"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.endsWith('/logos/placeholder-shield-a.png')) return;
                img.src = '/logos/placeholder-shield-a.png';
              }}
            />
            <p className="line-clamp-2 w-full text-center text-[11px] font-bold leading-snug text-white [overflow-wrap:anywhere] min-[380px]:text-[12px] sm:text-[13px]">
              {leftName}
            </p>
          </div>
          <div className="flex flex-col items-center justify-end pb-1">
            <span className="text-2xl font-black uppercase leading-none tracking-[0.12em] text-red-500 sm:text-3xl" aria-hidden>
              vs
            </span>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 border-l border-white/10 pl-1.5 sm:pl-3">
            <img
              src={rightLogoSrc}
              alt=""
              className="h-14 w-14 shrink-0 object-contain sm:h-[4.25rem] sm:w-[4.25rem]"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.endsWith('/logos/placeholder-shield-a.png')) return;
                img.src = '/logos/placeholder-shield-a.png';
              }}
            />
            <p className="line-clamp-2 w-full text-center text-[11px] font-bold leading-snug text-white [overflow-wrap:anywhere] min-[380px]:text-[12px] sm:text-[13px]">
              {rightName}
            </p>
          </div>
        </div>

        <div className="relative z-[1] mt-5 flex w-full flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-400/90">{kickoffHeaderLabel}</span>
          <p className="mt-1 text-4xl font-black tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)] sm:text-5xl">
            {showScore ? `${home} : ${away}` : timeStr}
          </p>
          {!showScore ? <span className="mt-1 text-sm font-medium text-white/80">Uhr</span> : null}
          {locationForKickoff ? (
            <p className="mt-3 max-w-[min(100%,20rem)] px-2 text-center text-[12px] font-medium leading-snug text-white/65 sm:text-[13px]">
              {locationForKickoff}
            </p>
          ) : null}
        </div>

        <div className="relative z-[1] mt-5 flex w-full flex-col items-center gap-2">
          {showMeetup && meetupTimeOnly ? (
            <div
              role="presentation"
              className="flex h-10 w-full max-w-xs items-center justify-center rounded-full border border-red-400/35 bg-red-700/85 px-5 text-sm font-semibold text-white shadow-lg shadow-black/40"
            >
              Treffpunkt: {meetupTimeOnly}
            </div>
          ) : null}
          {gameEndLabel ? (
            <div className="flex h-9 w-full max-w-xs items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white/88">
              Ende: {gameEndLabel}
            </div>
          ) : null}
          {gameDescription ? (
            <p className="line-clamp-2 max-w-xs text-center text-[11px] font-medium leading-snug text-white/55">{gameDescription}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  const trainingBlock = (
    <div className="relative flex min-h-[200px] flex-col items-center bg-gradient-to-b from-zinc-950 via-black to-zinc-950/95 px-3 pb-4 pt-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,38,38,0.12),transparent_55%)]" aria-hidden />
      {statusCluster}
      <TrainingMotifIcon className="relative z-[1] h-7 w-7 shrink-0 text-red-300/90" />
      {trainingTitle.trim() && trainingTitle.trim().toLowerCase() !== 'training' ? (
        <p className="relative z-[1] mt-1 line-clamp-1 max-w-[18rem] text-center text-[11px] font-medium text-white/65">
          {trainingTitle}
        </p>
      ) : null}
      <div className="relative z-[1] mt-3 w-full max-w-sm">
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
        <p className="relative z-[1] mt-1 line-clamp-2 max-w-[20rem] text-center text-[10px] leading-snug text-white/45">
          {locLine2}
        </p>
      ) : null}
      <div className="relative z-[1] mt-4 flex flex-wrap justify-center gap-2">
        {showMeetup && meetupTimeOnly ? (
          <div className="flex h-9 max-w-[320px] items-center justify-center rounded-full bg-red-800/80 px-5 text-sm font-medium text-white">
            <span className="whitespace-nowrap">Treffpunkt: {meetupTimeOnly}</span>
          </div>
        ) : null}
        {endDisplay ? (
          <div className="flex h-9 max-w-[320px] items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 text-sm font-medium text-white/90">
            <span className="whitespace-nowrap">Ende: {endDisplay}</span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const eventBlock = (
    <div className="relative flex min-h-[180px] flex-col items-center bg-gradient-to-b from-zinc-950/95 via-black/95 to-red-950/20 px-3 pb-4 pt-10">
      {statusCluster}
      <div className="flex items-center gap-2">
        <EventMotifIcon className="h-8 w-8 text-red-300/95" />
        <span className="line-clamp-2 max-w-[min(100%,18rem)] text-center text-sm font-bold text-white">
          {scheduleEventTypeLabel(ev, et)}
        </span>
      </div>
      <div className="mt-3 w-full max-w-sm">
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
        <div className="mt-3 flex justify-center">
          <span className="inline-flex max-w-full rounded-full border border-red-500/40 bg-red-950/50 px-3 py-1.5 text-[11px] font-semibold text-red-100">
            Treffpunkt: {meetupTimeOnly}
          </span>
        </div>
      ) : null}
    </div>
  );

  const innerRight =
    et === 'game' ? gameMatchday : et === 'training' ? trainingBlock : eventBlock;

  const inner = (
    <div className="grid grid-cols-[auto_1fr] gap-0 overflow-hidden rounded-2xl sm:gap-0">
      <div className="flex w-[2.65rem] shrink-0 flex-col items-center justify-start border-r border-white/10 bg-black/50 py-3 pr-1.5 pl-1 pt-2 text-center sm:w-11 sm:py-4">
        <span className="text-[8px] font-black leading-none text-red-300/95 sm:text-[9px]">{wd}</span>
        <span className="mt-0.5 text-lg font-black tabular-nums leading-none text-white sm:text-xl">{day}</span>
        <span className="mt-0.5 text-[8px] font-bold uppercase leading-tight text-white/50 sm:text-[9px]">{mon}</span>
      </div>
      <div className="min-w-0 overflow-hidden">{innerRight}</div>
    </div>
  );

  if (isPublicView) {
    return (
      <div className={baseCard} onClick={(e) => e.preventDefault()}>
        {inner}
      </div>
    );
  }

  if (isClickable && onNavigate) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={baseCard}
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

  return <div className={baseCard}>{inner}</div>;
}
