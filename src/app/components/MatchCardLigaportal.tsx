import React from 'react';
import { CalendarDays, ChevronRight, CircleHelp, Clock, MapPin, Radio, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
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
  const kickoffHeaderLabel = showScore && status === 'finished' ? 'ENDSTAND' : status === 'live' ? 'LIVE' : 'ANPFIFF';

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
  const opponentIsRight = isHome !== false;
  const rightLogoOverride = opponentIsRight ? (opponentLogoUrl ?? null) : null;
  const leftLogoOverride = opponentIsRight ? null : (opponentLogoUrl ?? null);

  const showManageButtons = canManage && (onEdit || onDelete);
  const showAttendanceChip =
    (role === 'parent' || role === 'player') && onOpenAttendance && !suppressInlineAttendanceChip;

  const attendanceChipClass = isTrainingCard
    ? attendanceStatus === 'no'
      ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-400/35 bg-red-600/80 text-white shadow-[0_0_12px_rgba(239,68,68,0.25)] transition-all duration-200'
      : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-600/80 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all duration-200'
    : attendanceStatus === 'yes'
      ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-600/80 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all duration-200'
      : attendanceStatus === 'no'
        ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-400/35 bg-red-600/80 text-white shadow-[0_0_12px_rgba(239,68,68,0.25)] transition-all duration-200'
        : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-700/60 text-white/80 transition-all duration-200';

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
    status !== 'live' &&
    ((showAttendanceCounts && attendanceCounts != null) ||
      showManageButtons ||
      showAttendanceChip);

  const compactParentRow = showAttendanceChip && !showAttendanceCounts && !showManageButtons;
  const heroDateParts = formatHeroDateParts(startsAt);

  const matchPhase: 'pre_meetup' | 'pre_kickoff' | 'live' | 'finished' = (() => {
    if (status === 'finished' || status === 'completed' || status === 'ended') return 'finished';
    if (status === 'live' || status === 'running') return 'live';
    const now = Date.now();
    if (meetupAt) {
      const meetupMs = new Date(meetupAt).getTime();
      if (now >= meetupMs) return 'pre_kickoff';
    }
    if (startsAt) {
      const kickoffMs = new Date(startsAt).getTime();
      if (now >= kickoffMs - 30 * 60 * 1000) return 'pre_kickoff';
    }
    return 'pre_meetup';
  })();

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
            <ThumbsUp className="h-4 w-4" strokeWidth={2} aria-hidden />
          ) : attendanceStatus === 'no' ? (
            <ThumbsDown className="h-4 w-4" strokeWidth={2} aria-hidden />
          ) : (
            <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />
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
      <div className="relative z-[1] mb-0 flex w-full min-w-0 items-start justify-between gap-1">
        <div className="flex w-[44px] shrink-0 flex-col items-center justify-center gap-0 text-center">
          <span className="text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-[#B85C68]/80">
            {heroDateParts.wd}
          </span>
          <span className="mt-px text-[30px] font-bold tabular-nums leading-none text-white">
            {heroDateParts.day}
          </span>
          <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/50">
            {heroDateParts.mon}
          </span>
          {heroYear ? <span className="text-[9px] font-medium leading-tight text-white/30">{heroYear}</span> : null}
        </div>
        {matchPhase === 'live' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.20)] animate-pulse">
            <Radio className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
            LIVE
          </span>
        ) : matchPhase === 'pre_kickoff' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-900/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-400/70">
            <Radio className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
            BALD LIVE
          </span>
        ) : matchPhase === 'finished' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
            BEENDET
          </span>
        ) : null}
        {showScheduleHeroTrailing ? (
          <div className="min-w-0 max-w-[min(48%,10rem)] shrink sm:max-w-none">
            {attendanceTrailing}
          </div>
        ) : null}
      </div>
    ) : null;

  const cardContent = (
    <>
      {/* Stadium ambient glow — intensity varies by match phase */}
      <div
        className={
          scheduleNextMatchHero
            ? matchPhase === 'live'
              ? 'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(122,29,42,0.28)_0%,rgba(58,18,24,0.14)_35%,transparent_65%),radial-gradient(ellipse_70%_50%_at_80%_0%,rgba(16,185,129,0.07)_0%,transparent_50%),radial-gradient(ellipse_90%_50%_at_50%_110%,rgba(58,18,24,0.10)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_30%)]'
              : matchPhase === 'finished'
                ? 'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_-10%,rgba(122,29,42,0.16)_0%,rgba(58,18,24,0.08)_40%,transparent_65%),radial-gradient(ellipse_90%_50%_at_50%_110%,rgba(20,10,14,0.10)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_25%)]'
                : matchPhase === 'pre_kickoff'
                  ? 'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(122,29,42,0.26)_0%,rgba(58,18,24,0.14)_35%,transparent_65%),radial-gradient(ellipse_60%_40%_at_75%_0%,rgba(16,185,129,0.05)_0%,transparent_50%),radial-gradient(ellipse_90%_50%_at_50%_110%,rgba(58,18,24,0.10)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_30%)]'
                  : 'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(122,29,42,0.24)_0%,rgba(58,18,24,0.12)_35%,transparent_65%),radial-gradient(ellipse_85%_55%_at_100%_-5%,rgba(255,245,230,0.10)_0%,transparent_55%),radial-gradient(ellipse_90%_50%_at_50%_110%,rgba(58,18,24,0.10)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_30%)]'
            : 'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_95%_60%_at_100%_0%,rgba(122,29,42,0.09)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_24%)]'
        }
        aria-hidden
      />
      {/* Vignette + edge darkening for stadium depth */}
      {scheduleNextMatchHero ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.45),inset_0_-30px_50px_rgba(0,0,0,0.25)]" aria-hidden />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,transparent_0%,rgba(0,0,0,0.20)_100%)]" aria-hidden />
        </>
      ) : null}
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
            leftLogoUrl={leftLogoOverride}
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
            <div className="relative z-[1] mt-0.5 px-0.5 pb-0.5">
              {matchPhase === 'finished' && isClickable ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-[12px] border border-white/[0.05] bg-[rgba(14,14,16,0.90)] px-3.5 py-2.5 shadow-[0_0_16px_rgba(0,0,0,0.25)]"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-white/50" strokeWidth={2} aria-hidden />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[13px] font-semibold text-white">Zum Spielbericht</span>
                    <span className="block text-[10px] text-white/40">Highlights, Statistiken & mehr</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} aria-hidden />
                </button>
              ) : matchPhase === 'live' ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-[12px] border border-emerald-400/15 bg-emerald-900/25 px-3.5 py-2.5 shadow-[0_0_18px_rgba(16,185,129,0.08)]"
                  onClick={(e) => { e.stopPropagation(); onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick(); }}
                >
                  <Radio className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 flex-1 text-left text-[13px] font-semibold text-white">Zum Livespiel</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400/50" strokeWidth={2} aria-hidden />
                </button>
              ) : matchPhase === 'pre_kickoff' ? (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-[12px] border border-emerald-400/15 bg-emerald-900/20 px-3.5 py-2.5 shadow-[0_0_14px_rgba(16,185,129,0.06)]"
                    onClick={(e) => { e.stopPropagation(); onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick(); }}
                  >
                    <Radio className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1 text-left text-[13px] font-semibold text-white">Zum Livespiel</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400/50" strokeWidth={2} aria-hidden />
                  </button>
                  {canSeeSensitiveInfo && meetupTimeOnly ? (
                    <div className="flex items-center gap-1.5 px-1.5 text-[10px] text-white/40">
                      <Users className="h-3 w-3 shrink-0 text-[#B85C68]/50" strokeWidth={2} aria-hidden />
                      <span>Treffpunkt {meetupTimeOnly} Uhr</span>
                    </div>
                  ) : null}
                </div>
              ) : canSeeSensitiveInfo && meetupTimeOnly ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-[12px] border border-[rgba(122,29,42,0.18)] bg-[rgba(122,29,42,0.14)] px-3.5 py-2.5 shadow-[0_0_20px_rgba(122,29,42,0.08)]"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                >
                  <Users className="h-4 w-4 shrink-0 text-[#B85C68]/80" strokeWidth={2} aria-hidden />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-white/40">Treffpunkt</span>
                    <span className="block text-[15px] font-bold tabular-nums text-white">{meetupTimeOnly} Uhr</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} aria-hidden />
                </button>
              ) : isClickable ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-3.5 py-2"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                >
                  <span className="min-w-0 flex-1 text-left text-[13px] font-semibold text-white/80">Details ansehen</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} aria-hidden />
                </button>
              ) : null}

              {/* Meta info bar */}
              {(canSeeSensitiveInfo && meetupTimeOnly && matchPhase === 'pre_meetup') || placeLine || (showAttendanceCounts && attendanceCounts) ? (
                <div className="mt-1 flex items-center gap-0 rounded-[10px] border border-white/[0.04] bg-white/[0.02] px-1 py-1 text-[10px] text-white/40">
                  {canSeeSensitiveInfo && meetupTimeOnly && matchPhase !== 'pre_meetup' ? (
                    <div className="flex items-center gap-1 px-2">
                      <Users className="h-2.5 w-2.5 shrink-0 text-[#B85C68]/50" strokeWidth={2} aria-hidden />
                      <span>{meetupTimeOnly}</span>
                    </div>
                  ) : null}
                  {placeLine ? (
                    <>
                      {canSeeSensitiveInfo && meetupTimeOnly && matchPhase !== 'pre_meetup' ? <span className="text-white/10">·</span> : null}
                      <div className="flex items-center gap-1 px-2">
                        <MapPin className="h-2.5 w-2.5 shrink-0 text-white/30" strokeWidth={2} aria-hidden />
                        <span className="line-clamp-1">{(placeLine.split(',')[0]?.trim()) || placeLine}</span>
                      </div>
                    </>
                  ) : null}
                  {showAttendanceCounts && attendanceCounts ? (
                    <>
                      {(placeLine || (canSeeSensitiveInfo && meetupTimeOnly && matchPhase !== 'pre_meetup')) ? <span className="text-white/10">·</span> : null}
                      <div className="flex items-center gap-1 px-2">
                        <Users className="h-2.5 w-2.5 shrink-0 text-white/30" strokeWidth={2} aria-hidden />
                        <span>{attendanceCounts.yes}/{attendanceCounts.yes + attendanceCounts.no + attendanceCounts.open}</span>
                      </div>
                    </>
                  ) : null}
                </div>
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
  const overflowClass = scheduleNextMatchHero ? 'overflow-visible' : 'overflow-hidden';
  const heroShadow = scheduleNextMatchHero
    ? matchPhase === 'live'
      ? 'shadow-[0_24px_60px_rgba(0,0,0,0.65),0_0_48px_rgba(122,29,42,0.18),0_0_24px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.04)]'
      : matchPhase === 'finished'
        ? 'shadow-[0_16px_40px_rgba(0,0,0,0.55),0_0_32px_rgba(122,29,42,0.10),inset_0_1px_0_rgba(255,255,255,0.03)]'
        : 'shadow-[0_24px_60px_rgba(0,0,0,0.65),0_0_48px_rgba(122,29,42,0.22),inset_0_1px_0_rgba(255,255,255,0.05)]'
    : 'shadow-[0_8px_28px_rgba(0,0,0,0.48),0_0_20px_rgba(122,29,42,0.06),inset_0_1px_0_rgba(255,255,255,0.025)]';
  const heroBorder = scheduleNextMatchHero
    ? matchPhase === 'live'
      ? 'border border-emerald-400/10'
      : matchPhase === 'finished'
        ? 'border border-white/[0.04]'
        : 'border border-[rgba(122,29,42,0.20)]'
    : '';
  const baseCardClass =
    `relative w-full max-w-none ${overflowClass} rounded-[14px] bg-[linear-gradient(168deg,#141416_0%,#0A0A0C_58%,#12080C_100%)] px-3 py-2 ${heroShadow} ${heroBorder} ${heroRing} ${className}`;
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
