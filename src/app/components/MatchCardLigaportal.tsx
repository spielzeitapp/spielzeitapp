import React from 'react';
import { CalendarDays, ChevronRight, CircleHelp, Clock, MapPin, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { TrainingPlayerIcon } from '../../components/schedule/TrainingPlayerIcon';
import { dsMatchdaySectionLabelClass } from '../../lib/premiumDesignSystem';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import type { EventKind, EventStatus } from '../../hooks/useEvents';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../../components/match/matchCardLabels';
import { MatchCardGameCore, MatchCardKickoffBlock } from '../../components/match/MatchCardGameCore';
import { formatHeroDateParts, scheduleMetaTimeDisplay } from '../../components/schedule/scheduleEventViewUtils';
import { TrainerStatsMini } from '../../components/schedule/TrainerStatsMini';
import { ScheduleHeroLiveCta } from '../../components/schedule/ScheduleHeroLiveCta';
import { ScheduleHeroMetaToolbar } from '../../components/schedule/ScheduleHeroMetaToolbar';

/** Datum kurz in Europe/Vienna (z. B. Sa. 06.06.2026). */
function formatDateShortDE(date: Date): string {
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

type MatchCardLigaportalProps = {
  ourTeamName: string;
  opponent: string | null;
  isHome: boolean | null;
  startsAt: string | null;
  status: EventStatus;
  kind: EventKind;
  eventType?: 'game' | 'training' | 'event' | 'other';
  /** Optional: für Training/Event Kurz-Titel/Beschreibung. */
  notes?: string | null;
  matchType?: string | null;
  location?: string | null;
  /** Straße, PLZ Ort */
  address?: string | null;
  meetupAt?: string | null;
  /** true = Treffpunkt anzeigen (canSeeMeetup). Spielort ist immer sichtbar. */
  showMeetup?: boolean;
  scoreHome?: number | null;
  scoreAway?: number | null;
  className?: string;
  eventId?: string | null;
  onNavigate?: (eventId: string) => void;
  opponentLogoUrl?: string | null;
  /** Nur für Trainer/Admin: Bearbeiten + Löschen anzeigen. Buttons stoppen Card-Klick. */
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Rolle (z. B. "parent" | "player") – bei parent/player wird "Zu-/Absage"-Button in der Header-Zeile angezeigt. */
  role?: string | null;
  /** Aktueller Zu-/Absage-Status (für Anzeige auf der Card). */
  attendanceStatus?: 'yes' | 'no' | null;
  /** Wird aufgerufen wenn Nutzer auf "Zu-/Absage" klickt (öffnet Modal). */
  onOpenAttendance?: () => void;
  /** Für Trainer/Admin: Counts für Zu-/Absagen-Übersicht (Zugesagt / Abgesagt / Offen). */
  attendanceCounts?: { yes: number; no: number; open: number } | null;
  /** true = öffentliche Ansicht: Karte nur Anzeige, keine Navigation, kein Link, kein onClick, Cursor default. */
  isPublicView?: boolean;
  /** Termine-UX: nächster Termin hervorheben (nur Darstellung). */
  heroHighlight?: boolean;
  /** Externe Zu-/Absage-UI: Chip in der Datumszeile ausblenden. */
  suppressInlineAttendanceChip?: boolean;
  /** Externe Teilnehmerzahlen: Ja/Nein/Offen in der Datumszeile ausblenden. */
  suppressInlineAttendanceCounts?: boolean;
  /** Termine-Liste: keine Kurz-Datumszeile über der Card; bei Spielen Datum-Badge in der Karte + optional keine „Uhr“ unter der Zeit. */
  scheduleNextMatchHero?: boolean;
  /** Nur „Nächstes Spiel“-Hero: Kalender-CTA in der Card. */
  onScheduleHeroAddToCalendar?: () => void;
  /** Nur „Nächstes Spiel“-Hero: Livespiel-CTA in der Card. */
  onScheduleHeroGoLive?: () => void;
  /** Event-Detail: Matchcard kompakter wie Schedule-Hero, ohne dessen Header/Actions. */
  compactDetailGame?: boolean;
};

export const MatchCardLigaportal: React.FC<MatchCardLigaportalProps> = ({
  ourTeamName,
  opponent,
  isHome,
  startsAt,
  status,
  kind,
  eventType,
  notes,
  matchType,
  location,
  address,
  meetupAt,
  showMeetup,
  scoreHome,
  scoreAway,
  className = '',
  eventId,
  onNavigate,
  opponentLogoUrl,
  canManage,
  onEdit,
  onDelete,
  role,
  attendanceStatus,
  onOpenAttendance,
  attendanceCounts,
  isPublicView = false,
  heroHighlight = false,
  suppressInlineAttendanceChip = false,
  suppressInlineAttendanceCounts = false,
  scheduleNextMatchHero = false,
  onScheduleHeroAddToCalendar,
  onScheduleHeroGoLive,
  compactDetailGame = false,
}) => {
  void ourTeamName;
  const ourClubName = getOurTeamDisplayName();
  const canSeeSensitiveInfo = showMeetup;
  const matchTypeLabel = getMatchTypeLabel(matchType);
  const meetupTimeOnly = formatMeetupTimeOnlyDe(meetupAt);
  const parsedLocation = splitCombinedLocation(location);
  const placeLine = parsedLocation.place;
  const addressLine = parsedLocation.address || (address ?? '').trim();
  const locationForKickoff = formatFullLocation(placeLine, addressLine) || null;

  const effectiveEventType: 'game' | 'training' | 'event' | 'other' =
    eventType ??
    (kind === 'training' ? 'training' : kind === 'event' ? 'event' : 'game');

  const isTrainingCard = effectiveEventType === 'training';

  let leftName: string;
  let rightName: string;

  const noteParts = (notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const notesTitle = noteParts[0] ?? null;

  const endRaw = noteParts.find((p) => p.toLowerCase().startsWith('ende:'));
  const endTimeLabel = endRaw
    ? endRaw.replace(/^ende:\s*/i, '').replace(/\s*uhr\s*$/i, '').trim()
    : null;

  const descriptionParts = noteParts.slice(1).filter((p) => !p.toLowerCase().startsWith('ende:'));
  const descriptionText = descriptionParts.length ? descriptionParts.join(' · ') : null;

  const headerTitle =
    effectiveEventType === 'game'
      ? matchTypeLabel
      : effectiveEventType === 'training'
        ? 'Training'
        : notesTitle ?? 'Termin';

  if (effectiveEventType === 'game') {
    // kind === 'match' – Heim/Auswärts-Logik bleibt erhalten
    if (isHome === true) {
      leftName = ourClubName;
      rightName = opponent ?? 'Gegner';
    } else if (isHome === false) {
      leftName = opponent ?? 'Gegner';
      rightName = ourClubName;
    } else {
      // Fallback: unser Team links, Gegner rechts
      leftName = ourClubName;
      rightName = opponent ?? 'Gegner';
    }
  } else {
    // Training/Event: nur unser Team (Opponent wird UI-seitig ausgeblendet)
    leftName = ourClubName;
    rightName = opponent ?? 'Termin';
  }

  const date = startsAt ? new Date(startsAt) : null;
  const dateLabelLong = date
    ? new Intl.DateTimeFormat('de-AT', {
        timeZone: VIENNA_TZ,
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date)
    : null;
  const dateLabelShort = date ? formatDateShortDE(date) : null;
  const timeStr = date
    ? new Intl.DateTimeFormat('de-AT', {
        timeZone: VIENNA_TZ,
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : '–';

  const hasScore = status === 'live' || status === 'finished';
  const showScore = hasScore && (scoreHome != null || scoreAway != null);
  const home = scoreHome ?? 0;
  const away = scoreAway ?? 0;
  const isMatch = effectiveEventType === 'game';
  const kickoffHeaderLabel = showScore && status === 'finished' ? 'ENDSTAND' : 'ANPFIFF';

  /** Nur Schedule „Nächstes Spiel“: Platzname (erstes Komma-Segment), volle Adresse auf EventDetail. */
  const scheduleHeroKickoffLocation =
    scheduleNextMatchHero && isMatch
      ? (() => {
          const p = (placeLine ?? '').trim();
          if (p) return (p.split(',')[0]?.trim() || p) || null;
          const raw = (location ?? '').trim();
          if (!raw) return null;
          return (raw.split(',')[0]?.trim() || raw) || null;
        })()
      : locationForKickoff;
  const detailGameKickoffLocation =
    compactDetailGame && isMatch
      ? (() => {
          const p = (placeLine ?? '').trim();
          if (p) return (p.split(',')[0]?.trim() || p) || null;
          const raw = (location ?? '').trim();
          if (!raw) return null;
          return (raw.split(',')[0]?.trim() || raw) || null;
        })()
      : scheduleHeroKickoffLocation;

  const handleCardClick = () => {
    if (!isPublicView && eventId && onNavigate) onNavigate(eventId);
  };

  const isClickable = !isPublicView && Boolean(eventId && onNavigate);
  const rightLogoOverride = opponentLogoUrl ?? null;

  const showManageButtons = canManage && (onEdit || onDelete);
  const showAttendanceChip =
    (role === 'parent' || role === 'player') && onOpenAttendance && !suppressInlineAttendanceChip;

  const attendanceChipClass = isTrainingCard
    ? attendanceStatus === 'no'
      ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)] transition-all duration-200'
      : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-all duration-200'
    : attendanceStatus === 'yes'
      ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-all duration-200'
      : attendanceStatus === 'no'
        ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)] transition-all duration-200'
        : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-zinc-700/75 text-white/90 transition-all duration-200';

  const attendanceChipAria = isTrainingCard
    ? attendanceStatus === 'no'
      ? 'Abgesagt'
      : 'Dabei'
    : attendanceStatus === 'yes'
      ? 'Zugesagt'
      : attendanceStatus === 'no'
        ? 'Abgesagt'
        : 'Offen';

  const showAttendanceCounts =
    canManage && attendanceCounts != null && !suppressInlineAttendanceCounts;

  const showScheduleHeroCalendar =
    Boolean(
      scheduleNextMatchHero &&
        effectiveEventType === 'game' &&
        status !== 'finished' &&
        !isPublicView &&
        onScheduleHeroAddToCalendar,
    );

  const showScheduleHeroGoLive =
    Boolean(
      scheduleNextMatchHero &&
        effectiveEventType === 'game' &&
        status !== 'finished' &&
        !isPublicView &&
        onScheduleHeroGoLive,
    );

  const showScheduleHeroTrailing =
    scheduleNextMatchHero &&
    effectiveEventType === 'game' &&
    ((showAttendanceCounts && attendanceCounts != null) ||
      showManageButtons ||
      showAttendanceChip);

  const compactParentRow = showAttendanceChip && !showAttendanceCounts && !showManageButtons;
  const heroDateParts = formatHeroDateParts(startsAt);

  const attendanceTrailing = (
    <div
      className={[
        'flex items-center gap-1.5 shrink-0 flex-wrap justify-end',
        compactParentRow || scheduleNextMatchHero ? '' : 'mt-1.5',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => e.stopPropagation()}
    >
      {showAttendanceCounts && attendanceCounts
        ? isTrainingCard ? (
            <div className="flex items-center gap-1.5" aria-label="Trainings-Teilnahme">
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold bg-red-600/20 text-red-400 border border-red-500/40 whitespace-nowrap"
                title="Abwesend"
              >
                {attendanceCounts.no}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold bg-green-600/20 text-green-400 border border-green-500/40 whitespace-nowrap"
                title="Dabei"
              >
                {attendanceCounts.yes + attendanceCounts.open}
              </span>
            </div>
          ) : scheduleNextMatchHero ? (
            <TrainerStatsMini
              yes={attendanceCounts.yes}
              no={attendanceCounts.no}
              open={attendanceCounts.open}
              isTraining={false}
              listColumn
              heroColumn
            />
          ) : (
            <div className="flex items-center gap-1.5" aria-label="Zu-/Absagen">
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold bg-green-600/20 text-green-400 border border-green-500/40 whitespace-nowrap"
                title="Zugesagt"
              >
                {attendanceCounts.yes}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold bg-red-600/20 text-red-400 border border-red-500/40 whitespace-nowrap"
                title="Abgesagt"
              >
                {attendanceCounts.no}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold bg-white/10 text-white/70 border border-white/25 whitespace-nowrap"
                title="Offen"
              >
                {attendanceCounts.open}
              </span>
            </div>
          )
        : null}
      {showManageButtons && (
        <>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="rounded-full bg-red-700/80 px-2.5 py-0.5 text-xs text-white shrink-0"
            >
              Bearbeiten
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-full bg-red-800/80 px-2.5 py-0.5 text-xs text-white shrink-0"
            >
              Löschen
            </button>
          )}
        </>
      )}
      {showAttendanceChip && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAttendance?.();
          }}
          className={attendanceChipClass}
          aria-label={attendanceChipAria}
          title={attendanceChipAria}
        >
          {attendanceStatus === 'yes' || (isTrainingCard && attendanceStatus !== 'no') ? (
            <ThumbsUp className="h-5 w-5" strokeWidth={2} aria-hidden />
          ) : attendanceStatus === 'no' ? (
            <ThumbsDown className="h-5 w-5" strokeWidth={2} aria-hidden />
          ) : (
            <CircleHelp className="h-5 w-5" strokeWidth={2} aria-hidden />
          )}
        </button>
      )}
    </div>
  );

  const dateRow =
    scheduleNextMatchHero || (isTrainingCard && compactDetailGame) ? null : (
    <div className="mb-2">
      <div className={`${compactParentRow ? 'flex items-center justify-between gap-2' : ''}`}>
        <span className="block text-base font-semibold text-white min-w-0 truncate">
          {date ? dateLabelShort : ''}
        </span>
        {attendanceTrailing}
      </div>
    </div>
  );

  const heroYear = startsAt ? new Date(startsAt).getFullYear().toString() : '';

  const scheduleGameHeader =
    scheduleNextMatchHero && effectiveEventType === 'game' ? (
      <div className="relative z-[1] mb-1.5 flex w-full min-w-0 items-start justify-between gap-1.5">
        <div className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-0 text-center">
          <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.12em] text-[#B85C68]">
            {heroDateParts.wd}
          </span>
          <span className="text-[34px] font-bold tabular-nums leading-none text-white">
            {heroDateParts.day}
          </span>
          <span className="text-[13px] font-medium leading-tight text-white/70">
            {heroDateParts.mon}
          </span>
          {heroYear ? <span className="text-[12px] font-medium leading-tight text-white/45">{heroYear}</span> : null}
        </div>
        {showScheduleHeroTrailing ? (
          <div className="min-w-0 max-w-[min(52%,11.5rem)] shrink pt-0.5 sm:max-w-none">
            {attendanceTrailing}
          </div>
        ) : null}
      </div>
    ) : null;

  const cardContent = (
    <>
      <div
        className={
          scheduleNextMatchHero
            ? 'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_85%_65%_at_100%_-5%,rgba(255,245,230,0.16)_0%,rgba(122,29,42,0.22)_32%,transparent_65%),radial-gradient(ellipse_90%_50%_at_50%_110%,rgba(58,18,24,0.12)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_32%)]'
            : 'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_95%_60%_at_100%_0%,rgba(122,29,42,0.09)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_24%)]'
        }
        aria-hidden
      />
      {/* Spielart bei Spielen: oberhalb „ANPFIFF“ in der Mittelspalte (MatchCardGameCore). Training/Event: Titel hier. */}
      {effectiveEventType !== 'game' && !isTrainingCard && headerTitle ? (
        <div className="flex justify-center">
          <p className="text-[17px] font-semibold text-white">{headerTitle}</p>
        </div>
      ) : null}

      {effectiveEventType === 'game' ? (
        <>
          {scheduleGameHeader}
          <MatchCardGameCore
            headerTitle={null}
            kickoffSubtitleAboveHeader={matchTypeLabel}
            kickoffHeaderLabel={kickoffHeaderLabel}
            leftName={leftName}
            rightName={rightName}
            opponentLogoUrl={rightLogoOverride}
            timeDisplay={timeStr}
            isMatch={isMatch}
            showScore={showScore}
            homeScore={home}
            awayScore={away}
            kickoffLocation={detailGameKickoffLocation}
            meetupTimeOnly={meetupTimeOnly}
            showMeetupPill={scheduleNextMatchHero ? false : Boolean(canSeeSensitiveInfo && meetupTimeOnly)}
            endTimeLabel={scheduleNextMatchHero ? null : endTimeLabel}
            descriptionText={descriptionText}
            variant="schedule"
            kickoffShowUhr={scheduleNextMatchHero ? false : undefined}
            compactScheduleHero={scheduleNextMatchHero}
            compactDetailGame={compactDetailGame}
            suppressCompactScheduleFooter={scheduleNextMatchHero}
          />
          {scheduleNextMatchHero ? (
            <div className="relative z-[1] mt-0.5 px-0.5 pb-1.5">
              <ScheduleHeroMetaToolbar
                items={[
                  {
                    icon: <Clock strokeWidth={2} aria-hidden />,
                    label: 'Beginn',
                    value: scheduleMetaTimeDisplay(timeStr),
                  },
                  {
                    icon: <Users strokeWidth={2} aria-hidden />,
                    label: 'Treffpunkt',
                    value:
                      canSeeSensitiveInfo && meetupTimeOnly
                        ? scheduleMetaTimeDisplay(meetupTimeOnly)
                        : 'Offen',
                    accent: Boolean(canSeeSensitiveInfo && meetupTimeOnly),
                  },
                  {
                    icon: <Clock strokeWidth={2} aria-hidden />,
                    label: 'Ende',
                    value: scheduleMetaTimeDisplay(endTimeLabel),
                  },
                ]}
                showChevron={isClickable}
                onChevronClick={isClickable ? handleCardClick : undefined}
              />
              {status === 'finished' && isClickable ? (
                <button
                  type="button"
                  className="mt-2.5 flex w-full min-h-[52px] items-center gap-3 rounded-[14px] border border-white/[0.06] bg-[rgba(18,18,20,0.92)] px-4 py-3.5 shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                >
                  <CalendarDays className="h-5 w-5 shrink-0 text-white/70" strokeWidth={2} aria-hidden />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[15px] font-semibold text-white">Zum Spielbericht</span>
                    <span className="block text-[11px] text-white/50">Highlights, Statistiken & mehr</span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-white/60" strokeWidth={2} aria-hidden />
                </button>
              ) : showScheduleHeroGoLive && onScheduleHeroGoLive ? (
                <ScheduleHeroLiveCta onClick={onScheduleHeroGoLive} />
              ) : canSeeSensitiveInfo && meetupTimeOnly && status !== 'live' ? (
                <button
                  type="button"
                  className="mt-2.5 flex w-full min-h-[52px] items-center gap-3 rounded-[14px] border border-[rgba(122,29,42,0.25)] bg-[rgba(122,29,42,0.18)] px-4 py-3.5 shadow-[0_0_28px_rgba(122,29,42,0.12)]"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                >
                  <Users className="h-5 w-5 shrink-0 text-[#B85C68]" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 flex-1 text-left text-[15px] font-semibold text-white">
                    Treffpunkt: {meetupTimeOnly} Uhr
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-white/60" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : isTrainingCard ? (
        <div className="relative z-[1] flex flex-col gap-2.5 px-1 py-1">
          <div className="flex items-center gap-3">
            <TrainingPlayerIcon variant="list" />
            <div className="min-w-0 flex-1">
              <p className={dsMatchdaySectionLabelClass()}>Training</p>
              <p className="mt-1 text-[17px] font-bold leading-tight tracking-tight text-white">
                {dateLabelLong ?? dateLabelShort ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-2">
            <div className="flex items-center gap-2 text-[13px]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#B85C68]" strokeWidth={2} aria-hidden />
              <span className="text-[#B8B0B4]">Beginn</span>
              <span className="ml-auto font-semibold tabular-nums text-white">{scheduleMetaTimeDisplay(timeStr)}</span>
            </div>
            {placeLine ? (
              <div className="flex items-start gap-2 text-[13px]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B85C68]" strokeWidth={2} aria-hidden />
                <span className="text-[#B8B0B4]">Ort</span>
                <span className="ml-auto max-w-[58%] text-right font-medium leading-snug text-white">{placeLine}</span>
              </div>
            ) : null}
            {canSeeSensitiveInfo && meetupTimeOnly ? (
              <div className="flex items-center gap-2 text-[13px]">
                <Users className="h-3.5 w-3.5 shrink-0 text-[#B85C68]" strokeWidth={2} aria-hidden />
                <span className="text-[#B8B0B4]">Treffpunkt</span>
                <span className="ml-auto font-semibold tabular-nums text-white">{scheduleMetaTimeDisplay(meetupTimeOnly)}</span>
              </div>
            ) : null}
            {endTimeLabel ? (
              <div className="flex items-center gap-2 text-[13px]">
                <Clock className="h-3.5 w-3.5 shrink-0 text-[#B85C68]" strokeWidth={2} aria-hidden />
                <span className="text-[#B8B0B4]">Ende</span>
                <span className="ml-auto font-semibold tabular-nums text-white">{scheduleMetaTimeDisplay(endTimeLabel)}</span>
              </div>
            ) : null}
          </div>
          {descriptionText ? (
            <p className="line-clamp-2 text-[12px] font-medium leading-snug text-[#B8B0B4]">{descriptionText}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            <MatchCardKickoffBlock
              timeDisplay={timeStr}
              showUhr
              location={null}
              headerLabel="BEGINN"
            />
            {placeLine ? (
              <div className="mt-1 flex min-h-9 max-w-[320px] items-center justify-center rounded-full border border-white/12 bg-white/[0.06] px-5 py-2 text-sm font-medium text-[#E8E4E6]">
                <span className="line-clamp-2 break-words">{placeLine}</span>
              </div>
            ) : null}
            {descriptionText ? (
              <div className="mt-1 max-w-[320px] line-clamp-2 text-[14px] font-semibold leading-snug text-[#B8B0B4]">
                {descriptionText}
              </div>
            ) : null}
          </div>
        </>
      )}
    </>
  );

  const heroRing = heroHighlight
    ? 'ring-2 ring-[rgba(122,29,42,0.45)] shadow-[0_0_40px_rgba(122,29,42,0.16)] sm:py-5'
    : '';
  const baseCardClass =
    `relative w-full max-w-none overflow-hidden rounded-[16px] bg-[linear-gradient(168deg,#141416_0%,#0A0A0C_58%,#12080C_100%)] px-[15px] py-3 shadow-[0_8px_28px_rgba(0,0,0,0.48),0_0_20px_rgba(122,29,42,0.06),inset_0_1px_0_rgba(255,255,255,0.025)] ${heroRing} ${className}`;
  const cardClass =
    isPublicView ? baseCardClass : `${baseCardClass} ${isClickable ? 'cursor-pointer transition ' : ''}`.trim();

  if (isPublicView) {
    const blockClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    return (
      <div
        className="flex w-full max-w-none flex-col gap-0"
        onClick={blockClick}
        onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        role="presentation"
      >
        {dateRow}
        <div className={`${baseCardClass} cursor-default`} onClick={blockClick}>{cardContent}</div>
      </div>
    );
  }

  const cardEl = isClickable ? (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={cardClass}
      aria-label={
        effectiveEventType === 'game'
          ? `Spiel ${leftName} gegen ${rightName}, ${dateLabelLong ?? dateLabelShort ?? ''} ${timeStr}`
          : `${headerTitle ?? 'Termin'}, ${dateLabelLong ?? dateLabelShort ?? ''} ${timeStr}`
      }
    >
      {cardContent}
    </div>
  ) : (
    <div className={cardClass}>{cardContent}</div>
  );

  return (
    <div className="flex w-full max-w-none flex-col gap-0">
      {dateRow}
      {cardEl}
    </div>
  );
}
