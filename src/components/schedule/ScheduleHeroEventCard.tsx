import React, { useState } from 'react';
import { Clock, Users } from 'lucide-react';
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
  scheduleMetaTimeDisplay,
} from './scheduleEventViewUtils';
import {
  dsPrimaryCtaClass,
  dsScheduleDateBoxDayClass,
  dsScheduleDateBoxMonthClass,
  dsScheduleDateBoxWeekdayClass,
  dsScheduleHeroDateBoxClass,
} from '../../lib/premiumDesignSystem';
import { EventMotifIcon } from './scheduleFootballMotifIcons';
import { TrainingPlayerIcon } from './TrainingPlayerIcon';
import { ScheduleHeroMetaToolbar } from './ScheduleHeroMetaToolbar';

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

/** Zeile 1 = erstes Wort (z. B. SPG), Zeile 2 = Rest (z. B. Weinburg) — nur Darstellung. */
function splitTeamDisplayName(displayName: string): { line1: string; line2: string } {
  const t = displayName.trim();
  if (!t) return { line1: '—', line2: '' };
  const idx = t.indexOf(' ');
  if (idx === -1) return { line1: t, line2: '' };
  return { line1: t.slice(0, idx), line2: t.slice(idx + 1).trim() };
}

function HeroTeamTwoLines({ displayName, matchColumn }: { displayName: string; matchColumn?: boolean }) {
  const { line1, line2 } = splitTeamDisplayName(displayName);
  return (
    <div
      className={
        matchColumn
          ? 'mt-1.5 flex w-full min-w-0 flex-col items-center gap-0.5 px-0.5 text-center'
          : 'mt-1.5 flex w-full max-w-[6.75rem] flex-col items-center gap-0.5 px-0.5 text-center sm:max-w-[7.25rem]'
      }
    >
      <span className="w-full break-words text-[11px] font-bold leading-snug text-white/90">{line1}</span>
      {line2 ? (
        <span className="w-full break-words text-[10px] font-semibold leading-snug text-white/78">{line2}</span>
      ) : null}
    </div>
  );
}

const stadiumBgUrl = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

/** Match-Hero: Logo 56px (SE) bis 64px (sm+). */
function HeroMatchTeamLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/14 bg-black/50 text-[1.65rem] leading-none sm:h-16 sm:w-16 sm:text-[1.85rem]"
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
      className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
      onError={() => setFailed(true)}
    />
  );
}

const heroStadiumGradient =
  'linear-gradient(to bottom, rgba(16,14,16,0.88) 0%, rgba(10,10,12,0.94) 46%, rgba(18,10,12,0.97) 100%)';

/** Stadion-Flutlicht, Fog, Bloom — cinematic Hero-Layer. */
function HeroHybridBackdrop({ training = false }: { training?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      <img
        src={stadiumBgUrl}
        alt=""
        className={`absolute inset-0 h-full min-h-full w-full min-w-full scale-110 object-cover ${
          training ? 'object-[92%_12%]' : 'object-[center_28%]'
        } opacity-[0.14] brightness-[0.52] saturate-[0.8]`}
        aria-hidden
      />
      <div className={`absolute inset-0 ${training ? 'bg-black/62' : 'bg-black/70'}`} aria-hidden />
      <div className="absolute inset-0 backdrop-blur-[3px] bg-black/12" aria-hidden />
      <div
        className={`absolute inset-0 ${
          training
            ? 'bg-[radial-gradient(ellipse_80%_60%_at_100%_-5%,rgba(255,245,230,0.18)_0%,rgba(122,29,42,0.24)_30%,transparent_65%)]'
            : 'bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(255,240,220,0.14)_0%,rgba(122,29,42,0.18)_32%,transparent_62%)]'
        }`}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-8%,rgba(122,29,42,0.14),transparent_58%),radial-gradient(ellipse_80%_50%_at_50%_110%,rgba(58,18,24,0.12),transparent_52%)]"
        aria-hidden
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_28%,rgba(0,0,0,0.2)_100%)]" aria-hidden />
      <div className="absolute inset-0" style={{ background: heroStadiumGradient }} aria-hidden />
    </div>
  );
}

function HeroMeetupCTA({ timeLabel }: { timeLabel: string }) {
  return (
    <div
      role="presentation"
      className={`mt-2 flex w-full min-w-0 max-w-full shrink-0 items-center justify-center gap-2 py-3.5 px-5 sm:mt-2 sm:px-6 ${dsPrimaryCtaClass()}`}
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
      <span className="text-[11px] font-black uppercase leading-none tracking-[0.12em] text-[#B85C68] sm:text-xs">
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

  /** Match-Hero: Datum in Zeile über Teams (nicht absolute — siehe gameBody). */
  const gameDateBadgeRow = (
    <div className="pointer-events-none flex shrink-0 flex-col items-start gap-0.5 rounded-xl border border-white/18 bg-black/68 px-2 py-2 text-left shadow-md backdrop-blur-md sm:gap-1 sm:px-2.5 sm:py-2">
      <span className="text-[10px] font-black uppercase leading-none tracking-[0.12em] text-red-200 sm:text-[11px]">
        {wd}
      </span>
      <span className="text-2xl font-black tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-3xl">
        {day}
      </span>
      <span className="text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-white/88 sm:text-[11px]">
        {mon}
      </span>
    </div>
  );

  const matchKindCenterLabel = matchTypeLabel?.trim() || 'Spiel';

  const gameStatsInline = topRight ? (
    <div className="pointer-events-none flex min-w-0 max-w-[46%] shrink-0 flex-col items-end self-start pt-0.5">
      <div className="pointer-events-auto origin-top-right scale-[0.82] sm:scale-[0.88]">{topRight}</div>
    </div>
  ) : null;

  const gameBody = (
    <>
      <HeroHybridBackdrop />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-3 pt-2">
        <div className="flex w-full min-w-0 shrink-0 items-start justify-between gap-2">
          {gameDateBadgeRow}
          {gameStatsInline ?? <span className="min-w-[2rem] shrink-0" aria-hidden />}
        </div>

        <div className="mt-2.5 flex w-full min-w-0 shrink-0 flex-row items-center justify-between gap-x-0.5 sm:gap-x-1">
          <div className="flex w-[26%] min-w-0 flex-col items-center justify-center px-0.5">
            <HeroMatchTeamLogo src={leftLogoSrc} />
            <HeroTeamTwoLines displayName={leftName} matchColumn />
          </div>

          <div className="flex w-[48%] min-w-0 flex-col items-center justify-center self-center border-x border-white/12 px-1 py-0.5 sm:px-1.5">
            <p className="px-0.5 text-center text-[9px] font-bold uppercase leading-snug tracking-[0.14em] text-white/88 sm:text-[10px] sm:tracking-[0.16em]">
              {matchKindCenterLabel}
            </p>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#B85C68] sm:text-[10px]">
              {kickoffHeaderLabel}
            </span>
            <span className="mt-1 text-center text-[2.2rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.55)] min-[375px]:text-[2.4rem] sm:text-[2.5rem]">
              {showScore ? `${home} : ${away}` : timeStr}
            </span>
            {!showScore ? (
              <span className="mt-0.5 text-[10px] font-medium normal-case tracking-normal text-white/48">Uhr</span>
            ) : null}

            {locLine1 || locLine2 ? (
              <div className="mt-1.5 w-full space-y-0.5 px-0.5 text-center">
                {locLine1 ? (
                  <p className="text-[11px] font-semibold leading-snug text-white/86 sm:text-[12px]">{locLine1}</p>
                ) : null}
                {locLine2 ? (
                  <p className="text-[9px] font-normal leading-snug text-white/42 sm:text-[10px]">{locLine2}</p>
                ) : null}
              </div>
            ) : locationForKickoff ? (
              <p className="mt-1.5 px-1 text-center text-[10px] font-medium leading-snug text-white/72 sm:text-[11px]">{locationForKickoff}</p>
            ) : null}
          </div>

          <div className="flex w-[26%] min-w-0 flex-col items-center justify-center px-0.5">
            <HeroMatchTeamLogo src={rightLogoSrc} />
            <HeroTeamTwoLines displayName={rightName} matchColumn />
          </div>
        </div>

        <div className="mx-auto mt-3 flex w-full min-w-0 max-w-[min(100%,24rem)] shrink-0 flex-col items-stretch">
          {showMeetup && meetupTimeOnly ? <HeroMeetupCTA timeLabel={meetupTimeOnly} /> : null}
          {gameEndLabel ? (
            <div className="mt-1.5 flex min-h-7 w-full shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.07] px-3 py-1 text-[10px] font-medium text-white/72">
              Ende: {gameEndLabel}
            </div>
          ) : null}
          {gameDescription ? (
            <p className="mt-1 break-words text-center text-[9px] font-normal leading-snug text-white/38">
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

  const trainingLocationLine =
    locLine1 || locLine2 ? [locLine1, locLine2].filter(Boolean).join(' · ') : locSingle || '—';

  const trainingMetaItems = [
    {
      icon: <Clock strokeWidth={2} aria-hidden />,
      label: 'Beginn',
      value: scheduleMetaTimeDisplay(timeStr),
    },
    {
      icon: <Users strokeWidth={2} aria-hidden />,
      label: 'Treffpunkt',
      value: showMeetup && meetupTimeOnly ? scheduleMetaTimeDisplay(meetupTimeOnly) : 'Offen',
    },
    {
      icon: <Clock strokeWidth={2} aria-hidden />,
      label: 'Ende',
      value: endDisplay ? scheduleMetaTimeDisplay(endDisplay) : 'Offen',
    },
  ];

  const openDetail = () => {
    if (ev.id && onNavigate) onNavigate(ev.id);
  };

  const trainingBody = (
    <>
      <HeroHybridBackdrop training />
      <div className="relative z-[1] flex w-full min-w-0 flex-col px-4 py-4 pb-3.5">
        <div className="flex items-start gap-3">
          <div className={dsScheduleHeroDateBoxClass()}>
            <span className={dsScheduleDateBoxWeekdayClass()}>{wd}</span>
            <span className={dsScheduleDateBoxDayClass()}>{day}</span>
            <span className={dsScheduleDateBoxMonthClass()}>{mon}</span>
          </div>


          <TrainingPlayerIcon variant="hero" className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[17px] font-bold leading-tight tracking-tight text-white">
                {trainingMainTitle}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-white/78">
                {trainingLocationLine}
              </p>
            </div>

          {topRight ? (
            <div className="pointer-events-auto shrink-0 pt-0.5">{topRight}</div>
          ) : null}
        </div>

        <ScheduleHeroMetaToolbar
          items={trainingMetaItems}
          showChevron={Boolean(isClickable && onNavigate)}
          onChevronClick={isClickable && onNavigate ? openDetail : undefined}
        />

      </div>
    </>
  );

  const eventBody = (
    <>
      <HeroHybridBackdrop />
      {dateBlock}
      {statusCluster}
      <div className="relative z-[1] flex w-full min-w-0 flex-col items-center px-2 pb-3 pt-3 sm:pb-3 sm:pt-3">
        <p className="mb-2 line-clamp-2 max-w-[min(100%,21rem)] text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 sm:text-xs">
          {scheduleEventTypeLabel(ev, et)}
        </p>

        <div className="grid w-full min-w-0 max-w-[min(100%,23.5rem)] grid-cols-[1fr_auto_1fr] items-stretch gap-x-1 sm:gap-x-2">
          <div className="min-h-[6.5rem] border-r border-white/[0.12]" aria-hidden />
          <div className="flex min-w-[7.25rem] max-w-[10rem] shrink-0 flex-col items-center px-2 pb-1 pt-0 sm:min-w-[7.75rem]">
            <div className="relative flex h-[4rem] w-[4rem] shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-white/14 to-black/45 shadow-[0_0_22px_rgba(255,255,255,0.05)] ring-2 ring-white/18 sm:h-[4.35rem] sm:w-[4.35rem]">
              <EventMotifIcon className="h-[2.35rem] w-[2.35rem] text-red-100 sm:h-[2.55rem] sm:w-[2.55rem]" />
            </div>
            <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.22em] text-red-400 sm:text-[10px]">Beginn</span>
            <span className="mt-1 text-center text-[2.35rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.52)] min-[375px]:text-[2.55rem] sm:text-[2.65rem]">
              {timeStr}
            </span>
            <span className="mt-1 text-[10px] font-medium text-white/42">Uhr</span>
          </div>
          <div className="min-h-[6.5rem] border-l border-white/[0.12]" aria-hidden />
        </div>

        <div className="mt-2 flex w-full min-w-0 flex-col items-center px-1">
          {locLine1 || locLine2 ? (
            <div className="max-w-[min(100%,21rem)] space-y-0.5 text-center">
              {locLine1 ? (
                <p className="text-[12px] font-semibold leading-snug text-white/82">{locLine1}</p>
              ) : null}
              {locLine2 ? (
                <p className="text-[10px] font-normal leading-snug text-white/42">{locLine2}</p>
              ) : null}
            </div>
          ) : locSingle ? (
            <p className="max-w-[min(100%,21rem)] text-center text-[11px] font-medium leading-snug text-white/68">{locSingle}</p>
          ) : null}

          {showMeetup && meetupTimeOnly ? <HeroMeetupCTA timeLabel={meetupTimeOnly} /> : null}
        </div>
      </div>
    </>
  );

  const body = et === 'game' ? gameBody : et === 'training' ? trainingBody : eventBody;

  const shell = (
    <div
      className={
        et === 'game'
          ? 'relative flex h-full min-h-0 w-full min-w-0 flex-col'
          : 'relative h-full min-h-0 w-full min-w-0 overflow-hidden'
      }
    >
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
