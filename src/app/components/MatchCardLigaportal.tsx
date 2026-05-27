import React from 'react';
import { CalendarDays, Check, ChevronRight, CircleHelp, Clock, MapPin, Radio, ThumbsDown, ThumbsUp, Trophy, Users } from 'lucide-react';
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

  const showScheduleHeroTrailing = false;

  const isHeroLayout = (scheduleNextMatchHero || compactDetailGame) && effectiveEventType === 'game';

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
  const heroMeetupTimeDisplay = scheduleMetaTimeDisplay(meetupTimeOnly).replace(/\s*Uhr$/i, '').trim();
  // TODO: wire readiness to saved lineup completeness
  const isLineupReady = false;

  const heroMatchMetaTile =
    'flex h-full min-h-[56px] min-w-0 flex-col items-center justify-center px-0.5 py-1.5 text-center sm:px-1';
  const heroMatchMetaTileBorder = 'border-l border-white/[0.05]';
  const heroMatchMetaIcon =
    'flex h-[18px] shrink-0 items-center text-[#B85C68] [&_svg]:h-[18px] [&_svg]:w-[18px]';
  const heroMatchMetaLabel =
    'mt-1 w-full text-[10px] font-semibold uppercase tracking-[0.08em] leading-none text-red-400/80';
  const heroMatchMetaValueWrap = 'mt-0.5 flex w-full max-w-full flex-col items-center leading-none';
  const heroMatchMetaSub = 'max-w-full text-[11px] font-medium leading-snug text-white';
  const heroMatchMetaSubMuted = 'max-w-full text-[11px] font-medium leading-snug text-white/80';
  const heroInfoTilesGrid =
    'mt-1 grid min-h-[56px] grid-cols-[0.9fr_1fr_1.15fr] items-stretch overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.03]';
  const heroLivePrepareStripe =
    'pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-6 shrink-0 items-center justify-center bg-red-700/85';

  const renderScheduleHeroLivePrepareTile = (onActivate: () => void) => (
    <div
      role="button"
      tabIndex={0}
      className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer pr-6`}
      style={{ WebkitAppearance: 'none' }}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <span className={`${heroMatchMetaIcon} text-red-400`}>
        <Radio strokeWidth={2} aria-hidden />
      </span>
      <span className={`${heroMatchMetaLabel} text-red-400`}>Livespiel</span>
      <div className={heroMatchMetaValueWrap}>
        <span className={heroMatchMetaSubMuted}>vorbereiten</span>
      </div>
      <div className={heroLivePrepareStripe} aria-hidden>
        <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.25} />
      </div>
    </div>
  );

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
    isHeroLayout || (isTrainingCard && compactDetailGame) ? null : (
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

  /* scheduleGameHeader removed — hero layout now inline in cardContent */

  const cardContent = (
    <>
      {/* Stadium ambient glow — intensity varies by match phase */}
      <div
        className={
          isHeroLayout
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
      {isHeroLayout ? (
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
        isHeroLayout ? (
          matchPhase === 'live' && scheduleNextMatchHero ? (
            /* ── Live Hero (simplified — score + CTA only) ── */
            <div className="relative z-[1] flex flex-col items-center gap-1.5 px-1 py-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-900/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.25)] animate-pulse">
                <Radio className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                LIVE
              </span>
              <MatchCardGameCore
                headerTitle={null}
                kickoffSubtitleAboveHeader={null}
                kickoffHeaderLabel="LIVE"
                leftName={leftName}
                rightName={rightName}
                opponentLogoUrl={rightLogoOverride}
                leftLogoUrl={leftLogoOverride}
                timeDisplay={timeStr}
                isMatch={true}
                showScore={showScore}
                homeScore={home}
                awayScore={away}
                kickoffLocation={null}
                meetupTimeOnly=""
                showMeetupPill={false}
                endTimeLabel={null}
                descriptionText={null}
                variant="schedule"
                kickoffShowUhr={false}
                compactScheduleHero
                compactDetailGame={false}
                suppressCompactScheduleFooter
              />
              <p className="text-[11px] font-medium text-emerald-400/60">Jetzt live</p>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-emerald-400/20 bg-emerald-600/20 px-4 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                onClick={(e) => { e.stopPropagation(); onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick(); }}
              >
                <Radio className="h-4 w-4 text-emerald-400" strokeWidth={2} aria-hidden />
                <span className="text-[13px] font-semibold text-emerald-400">Livespiel öffnen</span>
                <ChevronRight className="h-4 w-4 text-emerald-400/50" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : matchPhase === 'finished' && scheduleNextMatchHero ? (
            /* ── Finished Hero (simplified — result + CTA) ── */
            <div className="relative z-[1] flex flex-col items-center gap-1.5 px-1 py-1">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-white/40">
                BEENDET
              </span>
              <MatchCardGameCore
                headerTitle={null}
                kickoffSubtitleAboveHeader={null}
                kickoffHeaderLabel="ENDSTAND"
                leftName={leftName}
                rightName={rightName}
                opponentLogoUrl={rightLogoOverride}
                leftLogoUrl={leftLogoOverride}
                timeDisplay={timeStr}
                isMatch={true}
                showScore={showScore}
                homeScore={home}
                awayScore={away}
                kickoffLocation={null}
                meetupTimeOnly=""
                showMeetupPill={false}
                endTimeLabel={null}
                descriptionText={null}
                variant="schedule"
                kickoffShowUhr={false}
                compactScheduleHero
                compactDetailGame={false}
                suppressCompactScheduleFooter
              />
              <p className="text-[11px] font-medium text-white/40">Spiel beendet</p>
              {isClickable ? (
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.04] px-4"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                >
                  <CalendarDays className="h-4 w-4 text-white/50" strokeWidth={2} aria-hidden />
                  <span className="text-[13px] font-semibold text-white/70">Zum Spielbericht</span>
                  <ChevronRight className="h-4 w-4 text-white/30" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : (
          <div className="relative z-[1] flex min-h-0 w-full">
            {/* ── Date Column + Attendance ── */}
            <div className="flex w-[42px] shrink-0 flex-col items-center pt-1">
              <span className="text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-red-300">
                {heroDateParts.wd}
              </span>
              <span className="mt-0.5 text-[2rem] font-black tabular-nums leading-none text-white">
                {heroDateParts.day}
              </span>
              <span className="text-[11px] font-semibold uppercase leading-tight text-white/70">
                {heroDateParts.mon}
              </span>
              {heroYear ? <span className="text-[10px] font-medium leading-tight text-white/45">{heroYear}</span> : null}
              {showAttendanceCounts && attendanceCounts ? (
                <div className="mt-2.5 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-center">
                    <ThumbsUp className="h-3 w-3 text-emerald-400" strokeWidth={2.5} aria-hidden />
                    <span className="text-[13px] font-bold tabular-nums leading-tight text-emerald-400">{attendanceCounts.yes}</span>
                    <span className="text-[7px] font-bold uppercase tracking-wider text-emerald-400/70">Zusagen</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <CircleHelp className="h-3 w-3 text-amber-400" strokeWidth={2.5} aria-hidden />
                    <span className="text-[13px] font-bold tabular-nums leading-tight text-amber-400">{attendanceCounts.open}</span>
                    <span className="text-[7px] font-bold uppercase tracking-wider text-amber-400/70">Offen</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <ThumbsDown className="h-3 w-3 text-rose-400" strokeWidth={2.5} aria-hidden />
                    <span className="text-[13px] font-bold tabular-nums leading-tight text-rose-400">{attendanceCounts.no}</span>
                    <span className="text-[7px] font-bold uppercase tracking-wider text-rose-400/70">Absagen</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mx-1 w-px self-stretch bg-white/[0.06]" aria-hidden />

            {/* ── Main Content ── */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Match-Type Badge + Phase Badge */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pb-0.5">
                {matchTypeLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-[3px] text-[9px] font-bold uppercase tracking-wide text-white/80">
                    <Trophy className="h-2.5 w-2.5 text-red-400/60" strokeWidth={2} aria-hidden />
                    {matchTypeLabel}
                  </span>
                ) : null}
                {matchPhase === 'live' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-900/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.20)] animate-pulse">
                    <Radio className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                    LIVE
                  </span>
                ) : matchPhase === 'pre_kickoff' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-900/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400/70">
                    <Radio className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                    BALD LIVE
                  </span>
                ) : matchPhase === 'finished' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/40">
                    BEENDET
                  </span>
                ) : null}
              </div>

              {/* Team | Kickoff | Team */}
              <MatchCardGameCore
                headerTitle={null}
                kickoffSubtitleAboveHeader={null}
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
                kickoffLocation={null}
                meetupTimeOnly={meetupTimeOnly}
                showMeetupPill={false}
                endTimeLabel={null}
                descriptionText={descriptionText}
                variant="schedule"
                kickoffShowUhr={false}
                compactScheduleHero
                compactDetailGame={false}
                suppressCompactScheduleFooter
              />

              {/* ── Info Tiles (Schedule Hero only) ── */}
              {scheduleNextMatchHero ? (
                <div className={heroInfoTilesGrid} onClick={(e) => e.stopPropagation()}>
                  {canSeeSensitiveInfo && meetupTimeOnly ? (
                    <div className={heroMatchMetaTile}>
                      <span className={heroMatchMetaIcon}>
                        <Clock strokeWidth={2} aria-hidden />
                      </span>
                      <span className={heroMatchMetaLabel}>Treffpunkt</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className="max-w-full text-[14px] font-semibold tabular-nums leading-none text-white">
                          {heroMeetupTimeDisplay}
                        </span>
                        <span className="mt-0.5 text-[10px] font-medium text-white/65">Uhr</span>
                      </div>
                    </div>
                  ) : (
                    <div className={heroMatchMetaTile}>
                      <span className={`${heroMatchMetaIcon} text-white/20`}>
                        <Clock strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-white/25`}>Treffpunkt</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={`${heroMatchMetaSub} text-white/20`}>–</span>
                      </div>
                    </div>
                  )}

                  {placeLine ? (
                    <div className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder}`}>
                      <span className={heroMatchMetaIcon}>
                        <MapPin strokeWidth={2} aria-hidden />
                      </span>
                      <span className={heroMatchMetaLabel}>Spielort</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={`${heroMatchMetaSub} line-clamp-2`}>{placeLine}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder}`}>
                      <span className={`${heroMatchMetaIcon} text-white/20`}>
                        <MapPin strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-white/25`}>Spielort</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={`${heroMatchMetaSub} text-white/20`}>–</span>
                      </div>
                    </div>
                  )}

                  {matchPhase === 'finished' && isClickable ? (
                    <div
                      role="button"
                      tabIndex={0}
                      className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer pr-6`}
                      style={{ WebkitAppearance: 'none' }}
                      onClick={() => handleCardClick()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCardClick();
                        }
                      }}
                    >
                      <span className={`${heroMatchMetaIcon} text-white/50`}>
                        <CalendarDays strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-white/50`}>Spiel</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={heroMatchMetaSubMuted}>abschließen</span>
                      </div>
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-6 items-center justify-center bg-white/[0.10]" aria-hidden>
                        <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.25} />
                      </div>
                    </div>
                  ) : matchPhase === 'live' ? (
                    <div
                      role="button"
                      tabIndex={0}
                      className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer pr-6`}
                      style={{ WebkitAppearance: 'none' }}
                      onClick={() => (onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick();
                        }
                      }}
                    >
                      <span className={`${heroMatchMetaIcon} text-emerald-400`}>
                        <Radio className="animate-pulse" strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-emerald-400`}>Live</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={heroMatchMetaSubMuted}>öffnen</span>
                      </div>
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-6 items-center justify-center bg-emerald-600/80" aria-hidden>
                        <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.25} />
                      </div>
                    </div>
                  ) : matchPhase === 'pre_kickoff' ? (
                    isLineupReady ? (
                      <div
                        role="button"
                        tabIndex={0}
                        className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer pr-6`}
                        style={{ WebkitAppearance: 'none' }}
                        onClick={() => (onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick();
                          }
                        }}
                      >
                        <span className={`${heroMatchMetaIcon} text-emerald-400`}>
                          <Check strokeWidth={2.5} aria-hidden />
                        </span>
                        <span className={`${heroMatchMetaLabel} text-emerald-400`}>Live starten</span>
                        <div className={heroMatchMetaValueWrap}>
                          <span className={heroMatchMetaSubMuted}>bereit</span>
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-6 items-center justify-center bg-emerald-700/80" aria-hidden>
                          <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.25} />
                        </div>
                      </div>
                    ) : (
                      renderScheduleHeroLivePrepareTile(() =>
                        onScheduleHeroGoLive ? onScheduleHeroGoLive() : handleCardClick(),
                      )
                    )
                  ) : isClickable ? (
                    isLineupReady ? (
                      <div
                        role="button"
                        tabIndex={0}
                        className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer pr-6`}
                        style={{ WebkitAppearance: 'none' }}
                        onClick={() => handleCardClick()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCardClick();
                          }
                        }}
                      >
                        <span className={`${heroMatchMetaIcon} text-emerald-400`}>
                          <Check strokeWidth={2.5} aria-hidden />
                        </span>
                        <span className={`${heroMatchMetaLabel} text-emerald-400`}>Live starten</span>
                        <div className={heroMatchMetaValueWrap}>
                          <span className={heroMatchMetaSubMuted}>bereit</span>
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-6 items-center justify-center bg-emerald-700/80" aria-hidden>
                          <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.25} />
                        </div>
                      </div>
                    ) : (
                      renderScheduleHeroLivePrepareTile(() => handleCardClick())
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          )
        ) : (
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
            showMeetupPill={Boolean(canSeeSensitiveInfo && meetupTimeOnly)}
            endTimeLabel={endTimeLabel}
            descriptionText={descriptionText}
            variant="schedule"
            compactScheduleHero={false}
            compactDetailGame={false}
            suppressCompactScheduleFooter={false}
          />
        )
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
  const overflowClass = isHeroLayout ? 'overflow-visible' : 'overflow-hidden';
  const heroShadow = isHeroLayout
    ? matchPhase === 'live'
      ? 'shadow-[0_24px_60px_rgba(0,0,0,0.65),0_0_48px_rgba(122,29,42,0.18),0_0_24px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.04)]'
      : matchPhase === 'finished'
        ? 'shadow-[0_16px_40px_rgba(0,0,0,0.55),0_0_32px_rgba(122,29,42,0.10),inset_0_1px_0_rgba(255,255,255,0.03)]'
        : 'shadow-[0_24px_60px_rgba(0,0,0,0.65),0_0_48px_rgba(122,29,42,0.22),inset_0_1px_0_rgba(255,255,255,0.05)]'
    : 'shadow-[0_8px_28px_rgba(0,0,0,0.48),0_0_20px_rgba(122,29,42,0.06),inset_0_1px_0_rgba(255,255,255,0.025)]';
  const heroBorder = isHeroLayout
    ? matchPhase === 'live'
      ? 'border border-emerald-400/10'
      : matchPhase === 'finished'
        ? 'border border-white/[0.04]'
        : 'border border-[rgba(122,29,42,0.20)]'
    : '';
  const baseCardClass =
    `relative w-full max-w-none ${overflowClass} rounded-[14px] bg-[linear-gradient(168deg,#141416_0%,#0A0A0C_58%,#12080C_100%)] ${isHeroLayout ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${heroShadow} ${heroBorder} ${heroRing} ${className}`;
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
