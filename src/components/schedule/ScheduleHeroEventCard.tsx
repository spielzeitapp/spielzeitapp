import React, { useState } from 'react';
import { Bus, CalendarDays, ChevronRight, Clapperboard, ClipboardList, Clock, MapPin, PartyPopper, Pizza, Trophy, Users } from 'lucide-react';
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
  dsScheduleHeroDateBoxDayClass,
  dsScheduleHeroDateBoxMonthClass,
  dsScheduleHeroDateBoxWeekdayClass,
} from '../../lib/premiumDesignSystem';
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
        } ${training ? 'opacity-[0.16]' : 'opacity-[0.14]'} brightness-[0.5] saturate-[0.78]`}
        aria-hidden
      />
      <div className={`absolute inset-0 ${training ? 'bg-black/64' : 'bg-black/70'}`} aria-hidden />
      <div className={`absolute inset-0 ${training ? 'backdrop-blur-[4px] bg-black/14' : 'backdrop-blur-[3px] bg-black/12'}`} aria-hidden />
      <div
        className={`absolute inset-0 ${
          training
            ? 'bg-[radial-gradient(ellipse_88%_68%_at_100%_-8%,rgba(255,248,235,0.22)_0%,rgba(122,29,42,0.28)_28%,transparent_68%),radial-gradient(ellipse_55%_40%_at_88%_8%,rgba(255,255,255,0.06)_0%,transparent_55%)]'
            : 'bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(255,240,220,0.14)_0%,rgba(122,29,42,0.18)_32%,transparent_62%)]'
        }`}
        aria-hidden
      />
      <div
        className={`absolute inset-0 ${
          training
            ? 'bg-[radial-gradient(ellipse_100%_72%_at_50%_-8%,rgba(122,29,42,0.17),transparent_58%),radial-gradient(ellipse_82%_52%_at_50%_110%,rgba(58,18,24,0.14),transparent_52%)]'
            : 'bg-[radial-gradient(ellipse_100%_70%_at_50%_-8%,rgba(122,29,42,0.14),transparent_58%),radial-gradient(ellipse_80%_50%_at_50%_110%,rgba(58,18,24,0.12),transparent_52%)]'
        }`}
        aria-hidden
      />
      <div className={`absolute inset-0 ${training ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_26%,rgba(0,0,0,0.22)_100%)]' : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_28%,rgba(0,0,0,0.2)_100%)]'}`} aria-hidden />
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

function eventTypePremiumIcon(ev: EventRow, et: EffectiveEventType) {
  if (et === 'tournament' || ev.kind === 'tournament') return Trophy;
  const raw = `${eventNotesTitle(ev.notes) ?? ''} ${scheduleEventTypeLabel(ev, et) ?? ''}`.toLowerCase();
  if (raw.includes('film') || raw.includes('kino')) return Clapperboard;
  if (raw.includes('eltern')) return Users;
  if (raw.includes('abschluss') || raw.includes('fest') || raw.includes('feier')) return PartyPopper;
  if (raw.includes('essen') || raw.includes('pizza')) return Pizza;
  if (raw.includes('ausflug') || raw.includes('bus') || raw.includes('fahrt')) return Bus;
  if (raw.includes('besprech') || raw.includes('meeting')) return ClipboardList;
  return CalendarDays;
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
  const heroYear = ev.starts_at ? new Date(ev.starts_at).getFullYear().toString() : '';
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

  const eventTitle = (
    et === 'tournament'
      ? (eventNotesTitle(ev.notes) ?? 'Turnier')
      : (eventNotesTitle(ev.notes) ?? scheduleEventTypeLabel(ev, et) ?? 'Termin')
  ).trim();
  const eventTitleLen = eventTitle.length;
  const eventTitleSizeClass =
    eventTitleLen > 42
      ? 'text-[15px] min-[375px]:text-[16px]'
      : eventTitleLen > 30
        ? 'text-[16px] min-[375px]:text-[17px]'
        : 'text-[18px] min-[375px]:text-[19px]';
  /** Terminübersicht: nur Platzname/Ort, keine Adresse. */
  const eventTileOrtName = (parsedLoc.place || locLine1 || locSingle || '—').trim() || '—';
  const EventTypeIcon = eventTypePremiumIcon(ev, et);

  const trainingMetaItems = [
    {
      icon: <Users strokeWidth={2} aria-hidden />,
      label: 'Treffpunkt',
      value: showMeetup && meetupTimeOnly ? scheduleMetaTimeDisplay(meetupTimeOnly) : 'Offen',
    },
    {
      icon: <Clock strokeWidth={2} aria-hidden />,
      label: 'Beginn',
      value: scheduleMetaTimeDisplay(timeStr),
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
      <div className="relative z-[1] flex w-full min-w-0 flex-col px-3 py-2.5 pb-2.5">
        <div className="flex w-full min-w-0 items-center">
          <div className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-0 text-center">
            <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.12em] text-[#B85C68]">{wd}</span>
            <span className="text-[34px] font-bold tabular-nums leading-none text-white">{day}</span>
            <span className="text-[13px] font-medium leading-tight text-white/70">{mon}</span>
            {heroYear ? <span className="text-[12px] font-medium leading-tight text-white/45">{heroYear}</span> : null}
          </div>

          <TrainingPlayerIcon variant="hero" />

          <div className="min-w-0 flex-1 overflow-hidden text-left">
            <p className="text-[20px] font-bold leading-[1.05] text-white min-[375px]:text-[21px]">{trainingMainTitle}</p>
            <p className="mt-1 line-clamp-2 text-[15px] leading-[1.15] text-white/[0.78]">
              {trainingLocationLine}
            </p>
          </div>

          {topRight ? (
            <div className="pointer-events-auto flex w-[44px] shrink-0 flex-col items-center justify-center gap-2 self-center">
              {topRight}
            </div>
          ) : (
            <div className="w-[44px] shrink-0" aria-hidden />
          )}
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
      <HeroHybridBackdrop training />
      <div className="relative z-[1] flex w-full min-w-0 flex-col px-3 py-2.5 pb-2.5">
        <div className="flex w-full min-w-0 items-center">
          <div className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-0 text-center">
            <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.12em] text-[#B85C68]">{wd}</span>
            <span className="text-[34px] font-bold tabular-nums leading-none text-white">{day}</span>
            <span className="text-[13px] font-medium leading-tight text-white/70">{mon}</span>
            {heroYear ? <span className="text-[12px] font-medium leading-tight text-white/45">{heroYear}</span> : null}
          </div>

          <div className="relative mx-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(255,95,122,0.24)] bg-[radial-gradient(ellipse_70%_65%_at_30%_10%,rgba(255,120,160,0.22)_0%,rgba(68,18,30,0.42)_55%,rgba(14,14,18,0.92)_100%)] shadow-[0_0_18px_rgba(255,84,124,0.16),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <EventTypeIcon className="h-5 w-5 text-[#FF9CB1]" strokeWidth={2.1} aria-hidden />
          </div>

          <div className="min-w-0 flex-1 overflow-hidden text-left">
            <p
              className={`line-clamp-2 font-bold leading-[1.12] tracking-[0.01em] text-white break-words ${eventTitleSizeClass}`}
              title={eventTitle}
            >
              {eventTitle}
            </p>
          </div>

          {topRight ? (
            <div className="pointer-events-auto flex w-[44px] shrink-0 flex-col items-center justify-center gap-2 self-center">
              {topRight}
            </div>
          ) : (
            <div className="w-[44px] shrink-0" aria-hidden />
          )}
        </div>

        <div className="mt-2.5 border-t border-white/[0.04] bg-[rgba(0,0,0,0.22)]" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-[1fr_1fr_1fr_42px] items-center">
            <div className="flex min-h-[56px] min-w-0 flex-col items-center justify-center px-0.5 py-1.5 text-center sm:px-1">
              <span className="flex h-[18px] shrink-0 items-center text-[#B85C68] [&_svg]:h-[18px] [&_svg]:w-[18px]">
                <MapPin strokeWidth={2} aria-hidden />
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/42 leading-none">Ort</span>
              <div className="mt-0.5 flex w-full items-center justify-center px-0.5">
                <span className="max-w-full line-clamp-2 break-words text-center text-[11px] font-semibold leading-tight text-white">
                  {eventTileOrtName}
                </span>
              </div>
            </div>
            <div className="flex min-h-[56px] min-w-0 flex-col items-center justify-center border-l border-white/[0.05] px-0.5 py-1.5 text-center sm:px-1">
              <span className="flex h-[18px] shrink-0 items-center text-[#B85C68] [&_svg]:h-[18px] [&_svg]:w-[18px]">
                <Clock strokeWidth={2} aria-hidden />
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/42 leading-none">Beginn</span>
              <div className="mt-0.5 flex w-full flex-col items-center leading-none">
                <span className="max-w-full text-[16px] font-bold tabular-nums text-white">{scheduleMetaTimeDisplay(timeStr).replace(/\s*Uhr$/i, '')}</span>
                <span className="mt-0.5 text-[10px] font-medium text-white/65">Uhr</span>
              </div>
            </div>
            <div className="flex min-h-[56px] min-w-0 flex-col items-center justify-center border-l border-white/[0.05] px-0.5 py-1.5 text-center sm:px-1">
              <span className="flex h-[18px] shrink-0 items-center text-[#B85C68] [&_svg]:h-[18px] [&_svg]:w-[18px]">
                <ClipboardList strokeWidth={2} aria-hidden />
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/42 leading-none">Details</span>
              <div className="mt-0.5 flex w-full flex-col items-center leading-none">
                <span className="max-w-full truncate whitespace-nowrap text-[11px] font-semibold text-white/78">Infos</span>
              </div>
            </div>
            {isClickable && onNavigate ? (
              <button
                type="button"
                className="flex h-[56px] w-[42px] shrink-0 items-center justify-center border-l border-white/[0.05] bg-gradient-to-b from-teal-500/90 to-emerald-700/95 text-white shadow-[0_0_16px_rgba(16,185,129,0.28)] transition-colors hover:brightness-110"
                aria-label={et === 'tournament' ? 'Turnier öffnen' : 'Termin öffnen'}
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail();
                }}
              >
                <ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </button>
            ) : (
              <div className="h-[56px] border-l border-white/[0.05]" aria-hidden />
            )}
          </div>
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
      {et === 'training' ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-5%,rgba(122,29,42,0.10)_0%,transparent_60%)]" aria-hidden />
      ) : null}
      {et === 'tournament' ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-5%,rgba(88,28,135,0.14)_0%,transparent_60%)]" aria-hidden />
      ) : null}
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
