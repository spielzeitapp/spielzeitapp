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
        className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-xl border border-white/12 bg-black/50 text-xl leading-none sm:h-[3.75rem] sm:w-[3.75rem] sm:text-2xl"
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
      className="h-[3.25rem] w-[3.25rem] shrink-0 object-contain sm:h-[3.75rem] sm:w-[3.75rem]"
      onError={() => setFailed(true)}
    />
  );
}

const heroStadiumGradient =
  'linear-gradient(to bottom, rgba(5,2,2,0.94) 0%, rgba(0,0,0,0.91) 45%, rgba(55,8,12,0.88) 100%)';

/** Dezentes Stadion als Stimmung — wenig Bildanteil, starkes Overlay (alle Hero-Typen). */
function HeroHybridBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      <img
        src={stadiumBgUrl}
        alt=""
        className="absolute inset-0 h-full min-h-full w-full min-w-full scale-105 object-cover object-[center_35%] opacity-[0.09] brightness-[0.4] saturate-[0.85]"
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/62" aria-hidden />
      <div className="absolute inset-0 backdrop-blur-[3px] bg-black/18" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(120,25,25,0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="absolute inset-0" style={{ background: heroStadiumGradient }} aria-hidden />
    </div>
  );
}

function HeroMeetupCTA({ timeLabel }: { timeLabel: string }) {
  return (
    <div
      role="presentation"
      className="mt-2 flex w-full max-w-[min(100%,22rem)] items-center justify-center gap-2 rounded-full border-0 bg-gradient-to-r from-red-600 via-red-500 to-red-600 py-3 px-6 text-[15px] font-bold text-white shadow-lg shadow-red-950/50 sm:mt-2.5"
    >
      <Users className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
      <span>Treffpunkt: {timeLabel}</span>
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
    <div className="pointer-events-none absolute left-2 top-2 z-[2] flex max-w-[48%] flex-col items-start gap-1 rounded-xl border border-white/18 bg-black/68 px-3 py-2.5 text-left shadow-md backdrop-blur-md sm:left-3 sm:top-3 sm:max-w-[42%]">
      <span className="text-[11px] font-black uppercase leading-none tracking-[0.12em] text-red-200 sm:text-xs">
        {wd}
      </span>
      <span className="text-3xl font-black tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-4xl">
        {day}
      </span>
      <span className="text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-white/88 sm:text-xs">
        {mon}
      </span>
    </div>
  );

  const statusCluster = topRight ? (
    <div className="pointer-events-none absolute right-2 top-2 z-[2] flex max-w-[10.5rem] flex-col items-end sm:right-3 sm:top-3 sm:max-w-[11rem]">
      <div className="pointer-events-auto origin-top-right scale-[0.88]">{topRight}</div>
    </div>
  ) : null;

  const gameBody = (
    <>
      <HeroHybridBackdrop />
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-2 pb-3 pt-3 sm:pb-4 sm:pt-4">
        {matchTypeLabel ? (
          <p className="mb-1 line-clamp-2 max-w-[min(100%,20rem)] text-center text-[13px] font-semibold uppercase leading-snug tracking-[0.16em] text-white/88 sm:mb-1.5 sm:max-w-[24rem] sm:text-sm sm:tracking-[0.18em]">
            {matchTypeLabel}
          </p>
        ) : (
          <p className="mb-1 text-center text-[13px] font-semibold uppercase tracking-[0.18em] text-white/75 sm:mb-1.5 sm:text-sm">
            Spiel
          </p>
        )}

        <div className="grid w-full min-w-0 max-w-[min(100%,23rem)] grid-cols-[1fr_auto_1fr] items-end gap-x-3 sm:gap-x-6">
          <div className="flex min-w-0 flex-col items-center">
            <HeroTeamLogo src={leftLogoSrc} />
            <p className="mt-1 max-w-full truncate px-0.5 text-center text-[11px] font-semibold leading-tight text-white/78 sm:text-xs">
              {leftName}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-end self-end pb-px">
            <span
              className="-translate-y-px text-[2.65rem] font-black uppercase leading-none tracking-[0.14em] text-red-500 drop-shadow-[0_0_28px_rgba(239,68,68,0.42)] sm:text-5xl sm:tracking-widest"
              aria-hidden
            >
              vs
            </span>
          </div>
          <div className="flex min-w-0 flex-col items-center">
            <HeroTeamLogo src={rightLogoSrc} />
            <p className="mt-1 max-w-full truncate px-0.5 text-center text-[11px] font-semibold leading-tight text-white/78 sm:text-xs">
              {rightName}
            </p>
          </div>
        </div>

        <div className="mt-1.5 flex w-full min-w-0 flex-col items-center px-1 sm:mt-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-red-400">
            {kickoffHeaderLabel}
          </span>
          <p className="mt-1 flex max-w-full flex-nowrap items-baseline justify-center gap-x-1 text-center text-[2.45rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_4px_22px_rgba(0,0,0,0.55)] min-[375px]:text-[2.65rem] sm:text-6xl">
            <span>{showScore ? `${home} : ${away}` : timeStr}</span>
            {!showScore ? (
              <span className="text-[8px] font-medium normal-case tracking-normal text-white/32">Uhr</span>
            ) : null}
          </p>

          {locLine1 || locLine2 ? (
            <div className="mt-1 max-w-[min(100%,20rem)] space-y-px text-center">
              {locLine1 ? (
                <p className="line-clamp-2 text-[11px] font-medium leading-snug text-white/58 sm:text-xs">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="line-clamp-2 text-[10px] font-normal leading-snug text-white/36">{locLine2}</p>
              ) : null}
            </div>
          ) : locationForKickoff ? (
            <p className="mt-1 max-w-[min(100%,20rem)] px-1 text-center text-[11px] font-normal leading-snug text-white/52">
              {locationForKickoff}
            </p>
          ) : null}

          {showMeetup && meetupTimeOnly ? <HeroMeetupCTA timeLabel={meetupTimeOnly} /> : null}
          {gameEndLabel ? (
            <div className="mt-1.5 flex min-h-7 w-full max-w-xs items-center justify-center rounded-full border border-white/12 bg-white/[0.07] px-3 py-1 text-[10px] font-medium text-white/72">
              Ende: {gameEndLabel}
            </div>
          ) : null}
          {gameDescription ? (
            <p className="mt-0.5 line-clamp-2 max-w-xs text-center text-[9px] font-normal leading-snug text-white/38">
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
      <HeroHybridBackdrop />
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-2 pb-3 pt-3 sm:pb-4 sm:pt-4">
        <p className="mb-1 line-clamp-2 max-w-[min(100%,20rem)] text-center text-[13px] font-semibold uppercase leading-snug tracking-[0.14em] text-white/88 sm:mb-1.5 sm:text-sm">
          {trainingMainTitle}
        </p>

        <div className="grid w-full min-w-0 max-w-[min(100%,23rem)] grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-6">
          <div className="min-h-[3.25rem] min-w-0 sm:min-h-[3.75rem]" aria-hidden />
          <div className="flex flex-col items-center justify-center py-0.5">
            <div className="relative flex h-[4.35rem] w-[4.35rem] items-center justify-center rounded-full bg-gradient-to-b from-red-600/28 to-red-950/45 shadow-[0_0_36px_rgba(220,38,38,0.32)] ring-2 ring-red-500/50 sm:h-[4.85rem] sm:w-[4.85rem]">
              <TrainingMotifIcon className="h-[3.05rem] w-[3.05rem] text-red-50 sm:h-[3.4rem] sm:w-[3.4rem]" />
            </div>
          </div>
          <div className="min-h-[3.25rem] min-w-0 sm:min-h-[3.75rem]" aria-hidden />
        </div>

        <div className="mt-1.5 flex w-full min-w-0 flex-col items-center px-1 sm:mt-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-red-400">Beginn</span>
          <p className="mt-1 flex max-w-full flex-nowrap items-baseline justify-center gap-x-1 text-center text-[2.45rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_4px_22px_rgba(0,0,0,0.5)] min-[375px]:text-[2.65rem] sm:text-6xl">
            <span>{timeStr}</span>
            <span className="text-[8px] font-medium normal-case tracking-normal text-white/32">Uhr</span>
          </p>

          {locLine1 || locLine2 ? (
            <div className="mt-1 max-w-[min(100%,20rem)] space-y-px text-center">
              {locLine1 ? (
                <p className="line-clamp-2 text-[11px] font-medium leading-snug text-white/58 sm:text-xs">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="line-clamp-2 text-[10px] font-normal leading-snug text-white/36">{locLine2}</p>
              ) : null}
            </div>
          ) : locSingle ? (
            <p className="mt-1 max-w-[min(100%,20rem)] text-center text-[11px] font-normal leading-snug text-white/52">{locSingle}</p>
          ) : null}

          {showMeetup && meetupTimeOnly ? <HeroMeetupCTA timeLabel={meetupTimeOnly} /> : null}
          {endDisplay ? (
            <div className="mt-1.5 flex min-h-7 w-full max-w-xs items-center justify-center rounded-full border border-white/12 bg-white/[0.07] px-3 py-1 text-[10px] font-medium text-white/72">
              <span className="whitespace-nowrap">Ende: {endDisplay}</span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  const eventBody = (
    <>
      <HeroHybridBackdrop />
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-2 pb-3 pt-3 sm:pb-4 sm:pt-4">
        <p className="mb-1 line-clamp-2 max-w-[min(100%,20rem)] text-center text-[13px] font-semibold uppercase leading-snug tracking-[0.14em] text-white/88 sm:mb-1.5 sm:text-sm">
          {scheduleEventTypeLabel(ev, et)}
        </p>

        <div className="grid w-full min-w-0 max-w-[min(100%,23rem)] grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-6">
          <div className="min-h-[3.25rem] min-w-0 sm:min-h-[3.75rem]" aria-hidden />
          <div className="flex flex-col items-center justify-center py-0.5">
            <div className="relative flex h-[4.35rem] w-[4.35rem] items-center justify-center rounded-full bg-gradient-to-b from-white/12 to-black/40 shadow-[0_0_28px_rgba(255,255,255,0.06)] ring-2 ring-white/20 sm:h-[4.85rem] sm:w-[4.85rem]">
              <EventMotifIcon className="h-[2.65rem] w-[2.65rem] text-red-100 sm:h-12 sm:w-12" />
            </div>
          </div>
          <div className="min-h-[3.25rem] min-w-0 sm:min-h-[3.75rem]" aria-hidden />
        </div>

        <div className="mt-1.5 flex w-full min-w-0 flex-col items-center px-1 sm:mt-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-red-400">Beginn</span>
          <p className="mt-1 flex max-w-full flex-nowrap items-baseline justify-center gap-x-1 text-center text-[2.45rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_4px_22px_rgba(0,0,0,0.5)] min-[375px]:text-[2.65rem] sm:text-6xl">
            <span>{timeStr}</span>
            <span className="text-[8px] font-medium normal-case tracking-normal text-white/32">Uhr</span>
          </p>

          {locLine1 || locLine2 ? (
            <div className="mt-1 max-w-[min(100%,20rem)] space-y-px text-center">
              {locLine1 ? (
                <p className="line-clamp-2 text-[11px] font-medium leading-snug text-white/58 sm:text-xs">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="line-clamp-2 text-[10px] font-normal leading-snug text-white/36">{locLine2}</p>
              ) : null}
            </div>
          ) : locSingle ? (
            <p className="mt-1 max-w-[min(100%,20rem)] text-center text-[11px] font-normal leading-snug text-white/52">{locSingle}</p>
          ) : null}

          {showMeetup && meetupTimeOnly ? <HeroMeetupCTA timeLabel={meetupTimeOnly} /> : null}
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
