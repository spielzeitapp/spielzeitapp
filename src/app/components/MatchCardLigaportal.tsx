import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock,
  MapPin,
  Radio,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react';
import { TrainingPlayerIcon } from '../../components/schedule/TrainingPlayerIcon';
import { dsMatchdaySectionLabelClass } from '../../lib/premiumDesignSystem';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import type { EventKind, EventStatus } from '../../hooks/useEvents';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../../components/match/matchCardLabels';
import { MatchCardGameCore, MatchCardKickoffBlock } from '../../components/match/MatchCardGameCore';
import { MatchLiveAccessActionSheet } from '../../components/match/MatchLiveAccessActionSheet';
import { formatHeroDateParts, scheduleMetaTimeDisplay } from '../../components/schedule/scheduleEventViewUtils';
import { isMatchPreparationAccessible } from '../../lib/matchPreparationAccess';
import { TrainerStatsMini } from '../../components/schedule/TrainerStatsMini';
import { CompactListParentAttendance } from '../../components/schedule/CompactListParentAttendance';
import type { AttendanceStatusKind } from '../../components/schedule/AttendanceStatusPill';

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
  /** Trainer: Match-Vorbereitung (Kader → Aufstellung), nicht Livescreen. */
  onScheduleHeroPrepare?: () => void;
  /** Trainer: Startelf vollständig gespeichert → „Live starten“. */
  lineupReady?: boolean;
  /** Match-ID für Trainer-Hero-Navigation (Vorbereitung / Live). */
  scheduleHeroMatchId?: string | null;
  /** Match läuft (DB live_is_running) – Audience-Live-State auch wenn Event-Status noch nachzieht. */
  liveIsRunning?: boolean | null;
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
  onScheduleHeroPrepare,
  lineupReady = false,
  scheduleHeroMatchId = null,
  liveIsRunning = null,
  compactDetailGame = false,
}) => {
  const navigate = useNavigate();
  const [liveAccessSheetOpen, setLiveAccessSheetOpen] = useState(false);
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

  const audienceHeroRoles = new Set(['parent', 'player', 'fan']);
  const normalizedRole = (role ?? '').toLowerCase();
  const isAudienceHeroRole =
    scheduleNextMatchHero && effectiveEventType === 'game' && audienceHeroRoles.has(normalizedRole);
  const isAudienceRsvpHero = isAudienceHeroRole && (normalizedRole === 'parent' || normalizedRole === 'player');
  const showScheduleHeroCalendar =
    Boolean(
      scheduleNextMatchHero &&
        effectiveEventType === 'game' &&
        !isAudienceHeroRole &&
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
    if (status === 'live' || status === 'running' || liveIsRunning === true) return 'live';
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
  const isLineupReady = Boolean(lineupReady);

  const navigateToMatchPreparation = () => {
    const mid = (scheduleHeroMatchId ?? '').trim();
    if (!mid) return;
    navigate(`/app/match-preparation?matchId=${encodeURIComponent(mid)}`);
  };

  const navigateToLiveMatch = () => {
    const mid = (scheduleHeroMatchId ?? '').trim();
    if (!mid) return;
    navigate(`/app/live?matchId=${encodeURIComponent(mid)}`);
  };

  const isTrainerScheduleHero =
    scheduleNextMatchHero && effectiveEventType === 'game' && !isAudienceHeroRole && Boolean(canManage);

  const openTrainerLiveAccessSheet = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isTrainerScheduleHero || !isMatchPreparationAccessible(status)) return;
    if (!(scheduleHeroMatchId ?? '').trim()) return;
    setLiveAccessSheetOpen(true);
  };

  const goToMatchPreparationFromSheet = () => {
    setLiveAccessSheetOpen(false);
    if (onScheduleHeroPrepare) {
      onScheduleHeroPrepare();
      return;
    }
    navigateToMatchPreparation();
  };

  const goToLiveFromSheet = () => {
    setLiveAccessSheetOpen(false);
    if (onScheduleHeroGoLive) {
      onScheduleHeroGoLive();
      return;
    }
    navigateToLiveMatch();
  };

  const liveAccessSheetLiveLabel =
    matchPhase === 'live' ? 'Zum Livemodus' : 'Live starten';

  /** Trainer-Hero: Kartenklick (nicht Live-Kachel) → Event oder Vorbereitung. */
  const handleTrainerScheduleHeroClick = () => {
    if (!isTrainerScheduleHero) return;
    if (matchPhase === 'live' || isLineupReady) {
      if (onScheduleHeroGoLive) onScheduleHeroGoLive();
      else if ((scheduleHeroMatchId ?? '').trim()) navigateToLiveMatch();
      return;
    }
    if (onScheduleHeroPrepare) {
      onScheduleHeroPrepare();
      return;
    }
    if (!isPublicView && eventId && onNavigate) {
      onNavigate(eventId);
      return;
    }
    if ((scheduleHeroMatchId ?? '').trim()) navigateToMatchPreparation();
  };

  const handleCardClick = () => {
    if (!isPublicView && isTrainerScheduleHero) {
      handleTrainerScheduleHeroClick();
      return;
    }
    if (!isPublicView && eventId && onNavigate) onNavigate(eventId);
  };

  const handleScheduleHeroLiveAction = () => {
    if (isTrainerScheduleHero) {
      openTrainerLiveAccessSheet();
      return;
    }
    if (onScheduleHeroGoLive) onScheduleHeroGoLive();
    else handleCardClick();
  };

  const isClickable =
    !isPublicView &&
    (Boolean(eventId && onNavigate) ||
      (isTrainerScheduleHero && Boolean((scheduleHeroMatchId ?? '').trim())));

  const heroMatchMetaTile =
    'flex h-full min-h-0 min-w-0 flex-col items-center justify-center px-0.5 py-1 text-center sm:px-1';
  const heroMatchMetaTileBorder = 'border-l border-white/[0.05]';
  const heroMatchMetaIcon =
    'flex h-[18px] shrink-0 items-center text-[#B85C68] [&_svg]:h-[18px] [&_svg]:w-[18px]';
  const heroMatchMetaLabel =
    'mt-1 w-full whitespace-nowrap px-0.5 text-[9px] font-semibold uppercase tracking-[0.03em] leading-none text-red-400/80';
  const heroMatchMetaValueWrap = 'mt-0.5 flex w-full min-w-0 max-w-full flex-col items-center';
  const heroMatchMetaSub =
    'w-full min-w-0 max-w-full break-words text-[9.5px] font-medium leading-tight text-white/80';
  const heroMatchMetaSubPrimary = 'w-full min-w-0 max-w-full text-[9.5px] font-medium leading-tight text-white';
  const heroMatchMetaUhr = 'mt-0.5 text-[10px] font-medium leading-tight text-white/80';
  const heroInfoTilesGrid =
    'mt-1 grid h-[74px] grid-cols-[1.08fr_1fr_1.12fr] items-stretch overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.03]';
  const audienceInfoTilesGrid =
    'grid h-auto min-h-[64px] w-full grid-cols-[1fr_1fr_1.18fr] items-stretch overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.03]';
  const audienceMeetupTimeClass =
    'w-full min-w-0 whitespace-normal text-[11px] font-semibold tabular-nums leading-none text-white';
  const audienceMeetupUhrClass =
    'w-full min-w-0 text-[9px] font-medium leading-tight text-white/80';
  const audienceTileTextClass = (text: string, primary = true) => {
    const len = text.trim().length;
    const size =
      len > 34
        ? 'text-[7.5px] leading-[1.15]'
        : len > 26
          ? 'text-[8px] leading-[1.2]'
          : len > 18
            ? 'text-[8.5px] leading-tight'
            : primary
              ? 'text-[9.5px] leading-tight'
              : 'text-[9px] leading-tight';
    return `w-full min-w-0 whitespace-normal break-words hyphens-auto ${size} font-medium ${primary ? 'text-white' : 'text-white/80'}`;
  };
  const heroLivePrepareStripe =
    'pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-5 shrink-0 items-center justify-center bg-red-700/85';
  const audienceDetailsStripe =
    'pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-5 shrink-0 items-center justify-center bg-gradient-to-b from-teal-500/90 to-emerald-700/95 shadow-[0_0_16px_rgba(16,185,129,0.28)]';

  const wrapHeroTileActivate = (onActivate: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate();
  };

  const renderScheduleHeroLivePrepareTile = (onActivate: () => void) => (
    <div
      role="button"
      tabIndex={0}
      className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer pr-5`}
      style={{ WebkitAppearance: 'none' }}
      onClick={wrapHeroTileActivate(onActivate)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onActivate();
        }
      }}
    >
      <span className={`${heroMatchMetaIcon} text-red-400`}>
        <Radio strokeWidth={2} aria-hidden />
      </span>
      <span className={`${heroMatchMetaLabel} text-red-400`}>LIVE</span>
      <div className={heroMatchMetaValueWrap}>
        <span className={`${heroMatchMetaSubPrimary} text-white/90`}>Spiel</span>
        <span className={heroMatchMetaSub}>vorbereiten</span>
      </div>
      <div className={heroLivePrepareStripe} aria-hidden>
        <ChevronRight className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
      </div>
    </div>
  );

  const renderScheduleHeroLiveReadyTile = (onActivate: () => void) => (
    <div
      role="button"
      tabIndex={0}
      className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer pr-5`}
      style={{ WebkitAppearance: 'none' }}
      onClick={wrapHeroTileActivate(onActivate)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onActivate();
        }
      }}
    >
      <span className={`${heroMatchMetaIcon} text-emerald-400`}>
        <Check strokeWidth={2.5} aria-hidden />
      </span>
      <span className={`${heroMatchMetaLabel} text-emerald-400`}>Live starten</span>
      <div className={heroMatchMetaValueWrap}>
        <span className={heroMatchMetaSub}>bereit</span>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] flex w-5 shrink-0 items-center justify-center bg-emerald-700/80" aria-hidden>
        <ChevronRight className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
      </div>
    </div>
  );

  const renderScheduleHeroLiveOpenTile = (onActivate: () => void) => (
    <div
      role="button"
      tabIndex={0}
      className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 cursor-pointer overflow-hidden pr-5`}
      style={{ WebkitAppearance: 'none' }}
      onClick={wrapHeroTileActivate(onActivate)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onActivate();
        }
      }}
    >
      <span className={`${heroMatchMetaIcon} text-red-400`}>
        <Radio className="animate-pulse" strokeWidth={2} aria-hidden />
      </span>
      <span className={`${heroMatchMetaLabel} text-red-400`}>LIVE</span>
      <div className={heroMatchMetaValueWrap}>
        <span className={`${heroMatchMetaSubPrimary} text-white/90`}>Livespiel</span>
        <span className={heroMatchMetaSub}>öffnen</span>
      </div>
      <div className={heroLivePrepareStripe} aria-hidden>
        <ChevronRight className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
      </div>
    </div>
  );

  const splitAudienceHeroPlaceLines = (place: string): { line2: string; line3: string } => {
    const p = (place || '').trim();
    if (!p) return { line2: '–', line3: '' };
    if (p.toLowerCase().startsWith('sportplatz ')) {
      const rest = p.slice('sportplatz '.length).trim();
      return { line2: 'Sportplatz', line3: rest || '–' };
    }
    const idx = p.indexOf(' ');
    if (idx > 0) return { line2: p.slice(0, idx), line3: p.slice(idx + 1).trim() };
    return { line2: p, line3: '' };
  };

  const audienceMeetupTimeLine =
    canSeeSensitiveInfo && meetupTimeOnly ? heroMeetupTimeDisplay : '–';
  const audienceMeetupUhrLine = 'Uhr';
  const audienceSpielortLines = splitAudienceHeroPlaceLines(placeLine);

  const renderAudienceInfoTile = (
    icon: React.ReactNode,
    label: string,
    line2: string,
    line3: string,
    withBorder = false,
    muted = false,
    line2Class?: string,
    line3Class?: string,
  ) => (
    <div className={`${heroMatchMetaTile} ${withBorder ? heroMatchMetaTileBorder : ''}`}>
      <span className={`${heroMatchMetaIcon} ${muted ? 'text-white/20' : ''}`}>{icon}</span>
      <span className={`${heroMatchMetaLabel} ${muted ? 'text-white/25' : ''}`}>{label}</span>
      <div className={heroMatchMetaValueWrap}>
        <span
          className={
            line2Class ??
            `${audienceTileTextClass(line2, true)} ${muted ? '!text-white/20' : ''}`
          }
        >
          {line2}
        </span>
        {line3 ? (
          <span
            className={
              line3Class ??
              `${audienceTileTextClass(line3, false)} ${muted ? '!text-white/20' : ''}`
            }
          >
            {line3}
          </span>
        ) : null}
      </div>
    </div>
  );

  const audienceCanOpenLive = Boolean(onScheduleHeroGoLive || isClickable);

  const renderAudienceInfoTilesRow = () => (
    <div className={audienceInfoTilesGrid} onClick={(e) => e.stopPropagation()}>
      {renderAudienceInfoTile(
        <Clock strokeWidth={2} aria-hidden />,
        'TREFFPUNKT',
        audienceMeetupTimeLine,
        audienceMeetupUhrLine,
        false,
        !(canSeeSensitiveInfo && meetupTimeOnly),
        audienceMeetupTimeClass,
        audienceMeetupUhrClass,
      )}
      {renderAudienceInfoTile(
        <MapPin strokeWidth={2} aria-hidden />,
        'SPIELORT',
        audienceSpielortLines.line2,
        audienceSpielortLines.line3,
        true,
        !placeLine,
      )}
      {matchPhase === 'live' ? (
        <div
          role={audienceCanOpenLive ? 'button' : undefined}
          tabIndex={audienceCanOpenLive ? 0 : undefined}
          className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 overflow-hidden bg-red-950/25 pr-5 ${audienceCanOpenLive ? 'cursor-pointer shadow-[inset_0_0_18px_rgba(220,38,38,0.08)]' : 'pointer-events-none opacity-50'}`}
          onClick={
            audienceCanOpenLive
              ? (e) => {
                  e.stopPropagation();
                  handleScheduleHeroLiveAction();
                }
              : undefined
          }
          onKeyDown={
            audienceCanOpenLive
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleScheduleHeroLiveAction();
                  }
                }
              : undefined
          }
        >
          <span className={`${heroMatchMetaIcon} text-red-400`}>
            <Radio className="animate-pulse" strokeWidth={2} aria-hidden />
          </span>
          <span
            className={`${heroMatchMetaLabel} inline-flex items-center justify-center gap-1 text-red-400`}
          >
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.9)]" aria-hidden />
            JETZT LIVE
          </span>
          <div className={heroMatchMetaValueWrap}>
            <span className={`${heroMatchMetaSubPrimary} text-white/90`}>Livespiel</span>
            <span className={`${heroMatchMetaSub} text-white/75`}>öffnen</span>
          </div>
          <div className={heroLivePrepareStripe} aria-hidden>
            <ChevronRight className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
          </div>
        </div>
      ) : matchPhase === 'finished' ? (
        <div
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 overflow-hidden pr-5 ${isClickable ? 'cursor-pointer' : ''}`}
          onClick={
            isClickable
              ? (e) => {
                  e.stopPropagation();
                  handleCardClick();
                }
              : undefined
          }
          onKeyDown={
            isClickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCardClick();
                  }
                }
              : undefined
          }
        >
          <span className={`${heroMatchMetaIcon} text-white/80`}>
            <CalendarDays strokeWidth={2} aria-hidden />
          </span>
          <span className={`${heroMatchMetaLabel} text-white/80`}>BERICHT</span>
          <div className={heroMatchMetaValueWrap}>
            <span className={`${heroMatchMetaSubPrimary} text-white/90`}>Ergebnis</span>
            <span className={`${heroMatchMetaSub} text-white/65`}>ansehen</span>
          </div>
          <div className={`${heroLivePrepareStripe} bg-white/10`} aria-hidden>
            <ChevronRight className="h-3.5 w-3.5 text-white/75" strokeWidth={2.25} />
          </div>
        </div>
      ) : (
        <div
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} relative min-w-0 overflow-hidden bg-emerald-950/20 pr-5 ${isClickable ? 'cursor-pointer shadow-[inset_0_0_20px_rgba(16,185,129,0.06)]' : ''}`}
          onClick={
            isClickable
              ? (e) => {
                  e.stopPropagation();
                  handleCardClick();
                }
              : undefined
          }
          onKeyDown={
            isClickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCardClick();
                  }
                }
              : undefined
          }
        >
          <span className={heroMatchMetaIcon}>
            <CalendarDays strokeWidth={2} aria-hidden />
          </span>
          <span className={heroMatchMetaLabel}>DETAILS</span>
          <div className={heroMatchMetaValueWrap}>
            <span className={audienceTileTextClass('Adresse &', true)}>Adresse &</span>
            <span className={audienceTileTextClass('weitere Infos', false)}>weitere Infos</span>
          </div>
          <div className={audienceDetailsStripe} aria-hidden>
            <ChevronRight className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
          </div>
        </div>
      )}
    </div>
  );

  const audienceAttendancePillStatus = (): AttendanceStatusKind =>
    attendanceStatus === 'yes' ? 'yes' : attendanceStatus === 'no' ? 'no' : 'open';

  const renderAudienceHeroAttendanceButton = () =>
    isAudienceRsvpHero && onOpenAttendance ? (
      <div className="mt-1.5 flex w-full justify-center">
        <CompactListParentAttendance
          status={audienceAttendancePillStatus()}
          isTraining={false}
          context="hero"
          onOpen={onOpenAttendance}
        />
      </div>
    ) : null;

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
          matchPhase === 'live' && scheduleNextMatchHero && !isAudienceHeroRole ? (
            /* ── Live Hero (simplified — score + CTA only, Trainer) ── */
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
                onClick={(e) => {
                  e.stopPropagation();
                  openTrainerLiveAccessSheet(e);
                }}
              >
                <Radio className="h-4 w-4 text-emerald-400" strokeWidth={2} aria-hidden />
                <span className="text-[13px] font-semibold text-emerald-400">Livespiel öffnen</span>
                <ChevronRight className="h-4 w-4 text-emerald-400/50" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : matchPhase === 'finished' && scheduleNextMatchHero && !isAudienceHeroRole ? (
            /* ── Finished Hero (simplified — result + CTA, Trainer) ── */
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
          ) : isAudienceHeroRole && scheduleNextMatchHero ? (
          <div className="relative z-[1] flex w-full min-h-0 flex-col gap-0.5">
            <div className="grid w-full min-h-0 grid-cols-[36px_1px_minmax(0,1fr)] items-stretch gap-x-0.5">
            <div className="flex w-full flex-col items-center self-start pt-0.5">
              <span className="text-[9px] font-bold uppercase leading-none tracking-[0.16em] text-red-300">
                {heroDateParts.wd}
              </span>
              <span className="mt-0.5 text-[1.85rem] font-black tabular-nums leading-none text-white">
                {heroDateParts.day}
              </span>
              <span className="text-[10px] font-semibold uppercase leading-tight text-white/70">
                {heroDateParts.mon}
              </span>
              {heroYear ? <span className="text-[9px] font-medium leading-tight text-white/45">{heroYear}</span> : null}
              {renderAudienceHeroAttendanceButton()}
            </div>
            <div className="w-px self-stretch bg-white/[0.06]" aria-hidden />
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center justify-center gap-1.5 pb-0.5">
                {matchTypeLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-[3px] text-[9px] font-bold uppercase tracking-wide text-white/80">
                    <Trophy className="h-2.5 w-2.5 text-red-400/60" strokeWidth={2} aria-hidden />
                    {matchTypeLabel}
                  </span>
                ) : null}
                {matchPhase === 'live' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-red-400 shadow-[0_0_10px_rgba(220,38,38,0.22)]">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-400" aria-hidden />
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
                showScore={matchPhase === 'live' || matchPhase === 'finished' ? false : showScore}
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
              {showScore && (matchPhase === 'live' || matchPhase === 'finished') ? (
                <p className="mt-0.5 text-center text-[11px] font-bold tabular-nums leading-none text-white/85">
                  {home}:{away}
                </p>
              ) : null}
            </div>
            </div>
            {renderAudienceInfoTilesRow()}
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
              {renderAudienceHeroAttendanceButton()}
              {!isAudienceHeroRole && showAttendanceCounts && attendanceCounts ? (
                <button
                  type="button"
                  className="mt-2.5 inline-flex items-center justify-center rounded-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAttendance?.();
                  }}
                  aria-label="Zu-/Absagen öffnen"
                >
                  <TrainerStatsMini
                    yes={attendanceCounts.yes}
                    no={attendanceCounts.no}
                    open={attendanceCounts.open}
                    isTraining={false}
                    listColumn
                    size="hero"
                  />
                </button>
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

              {/* ── Info Tiles (Schedule Hero only, Trainer) ── */}
              {scheduleNextMatchHero ? (
                <div className={heroInfoTilesGrid} onClick={(e) => e.stopPropagation()}>
                  {canSeeSensitiveInfo && meetupTimeOnly ? (
                    <div className={heroMatchMetaTile}>
                      <span className={heroMatchMetaIcon}>
                        <Clock strokeWidth={2} aria-hidden />
                      </span>
                      <span className={heroMatchMetaLabel}>Treffpunkt</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className="w-full min-w-0 max-w-full text-[14px] font-semibold tabular-nums leading-none text-white">
                          {heroMeetupTimeDisplay}
                        </span>
                        <span className={heroMatchMetaUhr}>Uhr</span>
                      </div>
                    </div>
                  ) : (
                    <div className={heroMatchMetaTile}>
                      <span className={`${heroMatchMetaIcon} text-white/20`}>
                        <Clock strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-white/25`}>Treffpunkt</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={`${heroMatchMetaSubPrimary} text-white/20`}>–</span>
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
                        <span className={`${heroMatchMetaSub} line-clamp-2 break-words`}>{placeLine}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder}`}>
                      <span className={`${heroMatchMetaIcon} text-white/20`}>
                        <MapPin strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-white/25`}>Spielort</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={`${heroMatchMetaSubPrimary} text-white/20`}>–</span>
                      </div>
                    </div>
                  )}

                  {matchPhase === 'live' ? (
                    onScheduleHeroGoLive || isClickable
                      ? renderScheduleHeroLiveOpenTile(openTrainerLiveAccessSheet)
                      : (
                    <div className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder} pointer-events-none opacity-50`}>
                      <span className={`${heroMatchMetaIcon} text-red-400/50`}>
                        <Radio strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-red-400/50`}>LIVE</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={heroMatchMetaSub}>öffnen</span>
                      </div>
                    </div>
                      )
                  ) : isLineupReady ? (
                    renderScheduleHeroLiveReadyTile(openTrainerLiveAccessSheet)
                  ) : isClickable ? (
                    renderScheduleHeroLivePrepareTile(openTrainerLiveAccessSheet)
                  ) : (
                    <div className={`${heroMatchMetaTile} ${heroMatchMetaTileBorder}`}>
                      <span className={`${heroMatchMetaIcon} text-red-400/50`}>
                        <Radio strokeWidth={2} aria-hidden />
                      </span>
                      <span className={`${heroMatchMetaLabel} text-red-400/50`}>Livespiel</span>
                      <div className={heroMatchMetaValueWrap}>
                        <span className={`${heroMatchMetaSub} text-white/40`}>vorbereiten</span>
                      </div>
                    </div>
                  )}
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
  const audienceHeroPadding =
    isAudienceHeroRole && scheduleNextMatchHero ? 'px-2 py-1' : isHeroLayout ? 'px-2.5 py-1.5' : 'px-3 py-2';
  const baseCardClass =
    `relative w-full max-w-none ${overflowClass} rounded-[14px] bg-[linear-gradient(168deg,#141416_0%,#0A0A0C_58%,#12080C_100%)] ${audienceHeroPadding} ${heroShadow} ${heroBorder} ${heroRing} ${className}`;
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
    <>
      <div className="flex w-full max-w-none flex-col gap-0">
        {dateRow}
        {cardEl}
      </div>
      {isTrainerScheduleHero ? (
        <MatchLiveAccessActionSheet
          open={liveAccessSheetOpen}
          onClose={() => setLiveAccessSheetOpen(false)}
          onPrepare={goToMatchPreparationFromSheet}
          onLive={goToLiveFromSheet}
          liveActionLabel={liveAccessSheetLiveLabel}
        />
      ) : null}
    </>
  );
}
