import React from 'react';
import type { EventRow } from '../../hooks/useEvents';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatFullLocation, formatLocationTwoLines, splitCombinedLocation } from '../../lib/eventLocation';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import { MatchCardGameCore, MatchCardKickoffBlock } from '../match/MatchCardGameCore';
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

export function ScheduleHeroEventCard({
  ev,
  et,
  ourTeamName: _ourTeamName,
  opponentLogoUrl,
  scoreHome,
  scoreAway,
  showMeetup,
  topRight,
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
  if (ev.is_home === true) {
    leftName = ourClubName;
    rightName = opp;
  } else if (ev.is_home === false) {
    leftName = opp;
    rightName = ourClubName;
  } else {
    leftName = ourClubName;
    rightName = opp;
  }

  const matchTypeLabel = getMatchTypeLabel(ev.match_type);
  const kickoffHeaderLabel = showScore && ev.status === 'finished' ? 'ENDSTAND' : 'ANPFIFF';

  const handleCardClick = () => {
    if (!isPublicView && isClickable && onNavigate) onNavigate(ev.id);
  };

  const cardClass = [
    'relative w-full overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-b from-zinc-950/95 via-black/92 to-red-950/25 px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_48px_rgba(220,38,38,0.14)] sm:px-3 sm:py-3.5',
    !isPublicView && isClickable ? 'cursor-pointer transition hover:border-red-500/50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const statusSlot = topRight ? (
    <div className="pointer-events-none absolute right-1 top-1 z-[4] max-w-[min(42%,10.5rem)] sm:right-2 sm:top-1.5 sm:max-w-[11rem]">
      <div className="pointer-events-auto">{topRight}</div>
    </div>
  ) : null;

  const gameCore = (
    <div className={`relative min-w-0 ${topRight ? 'pr-0.5 pt-6 sm:pt-7' : ''}`}>
      {statusSlot}
      <MatchCardGameCore
        headerTitle={null}
        kickoffSubtitleAboveHeader={matchTypeLabel}
        kickoffHeaderLabel={kickoffHeaderLabel}
        leftName={leftName}
        rightName={rightName}
        opponentLogoUrl={opponentLogoUrl ?? null}
        timeDisplay={timeStr}
        isMatch
        showScore={showScore}
        homeScore={home}
        awayScore={away}
        kickoffLocation={locationForKickoff}
        meetupTimeOnly={meetupTimeOnly}
        showMeetupPill={Boolean(showMeetup && meetupTimeOnly)}
        endTimeLabel={gameEndLabel}
        descriptionText={gameDescription}
        variant="home-hero"
      />
    </div>
  );

  const trainingBlock = (
    <div className={`relative min-w-0 ${topRight ? 'pr-0.5 pt-6 sm:pt-7' : ''}`}>
      {statusSlot}
      <div className="flex flex-col items-center gap-1.5 px-1">
        <div className="flex items-center justify-center gap-2">
          <TrainingMotifIcon className="h-8 w-8 shrink-0 text-red-300/95 sm:h-9 sm:w-9" />
          <span className="text-center text-[13px] font-black uppercase leading-tight tracking-wide text-white sm:text-sm">
            {trainingTitle}
          </span>
        </div>
        <MatchCardKickoffBlock
          timeDisplay={timeStr}
          showUhr
          location={locSingle || null}
          headerLabel="BEGINN"
          subtitleAboveHeader={null}
          hero={false}
        />
        {locLine2 && locLine2.toLowerCase() !== (locLine1 ?? '').toLowerCase() ? (
          <p className="line-clamp-2 max-w-[min(100%,20rem)] text-center text-[10px] leading-snug text-white/50">
            {locLine2}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap justify-center gap-1.5">
          {showMeetup && meetupTimeOnly ? (
            <span className="inline-flex max-w-full rounded-full border border-red-500/40 bg-red-950/50 px-3 py-1.5 text-[11px] font-semibold text-red-100">
              Treffpunkt: {meetupTimeOnly}
            </span>
          ) : null}
          {endDisplay ? (
            <span className="inline-flex max-w-full rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85">
              Ende: {endDisplay}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  const eventBlock = (
    <div className={`relative min-w-0 ${topRight ? 'pr-0.5 pt-6 sm:pt-7' : ''}`}>
      {statusSlot}
      <div className="flex flex-col items-center gap-2 px-1">
        <div className="flex items-center justify-center gap-2">
          <EventMotifIcon className="h-8 w-8 text-red-300/95" />
          <span className="line-clamp-2 max-w-[min(100%,18rem)] text-center text-sm font-bold text-white">
            {scheduleEventTypeLabel(ev, et)}
          </span>
        </div>
        <MatchCardKickoffBlock
          timeDisplay={timeStr}
          showUhr
          location={locSingle || null}
          headerLabel="BEGINN"
          subtitleAboveHeader={null}
          hero={false}
        />
        {showMeetup && meetupTimeOnly ? (
          <div className="mt-1 flex justify-center">
            <span className="inline-flex max-w-full rounded-full border border-red-500/40 bg-red-950/50 px-3 py-1.5 text-[11px] font-semibold text-red-100">
              Treffpunkt: {meetupTimeOnly}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const inner = (
    <div className="grid grid-cols-[auto_1fr] gap-2 sm:gap-3">
      <div className="flex w-[2.75rem] shrink-0 flex-col items-center self-start border-r border-white/10 pr-2 pt-1 text-center sm:w-12 sm:pt-1.5">
        <span className="text-[8px] font-black leading-none text-red-300/95 sm:text-[9px]">{wd}</span>
        <span className="mt-0.5 text-lg font-black tabular-nums leading-none text-white sm:text-xl">{day}</span>
        <span className="mt-0.5 text-[8px] font-bold uppercase leading-tight text-white/50 sm:text-[9px]">{mon}</span>
      </div>
      <div className="min-w-0">
        {et === 'game' ? gameCore : et === 'training' ? trainingBlock : eventBlock}
      </div>
    </div>
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
