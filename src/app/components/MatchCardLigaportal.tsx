import React from 'react';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import type { EventKind, EventStatus } from '../../hooks/useEvents';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../../components/match/matchCardLabels';
import { MatchCardGameCore, MatchCardKickoffBlock } from '../../components/match/MatchCardGameCore';

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
}) => {
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

  const handleCardClick = () => {
    if (!isPublicView && eventId && onNavigate) onNavigate(eventId);
  };

  const isClickable = !isPublicView && Boolean(eventId && onNavigate);
  const rightLogoOverride = opponentLogoUrl ?? null;

  const showManageButtons = canManage && (onEdit || onDelete);
  const showAttendanceChip = (role === 'parent' || role === 'player') && onOpenAttendance;

  /* Pill wie Bearbeiten/Löschen: gleiche Höhe/Radius (rounded-full px-3 py-1 text-sm), farblich passend */
  const attendanceChipClass = isTrainingCard
    ? attendanceStatus === 'no'
      ? 'rounded-full px-2.5 py-0.5 text-xs font-semibold text-white bg-red-700 border border-red-600/50 shrink-0'
      : 'rounded-full px-2.5 py-0.5 text-xs font-semibold text-white bg-green-600 border border-green-500/50 shrink-0'
    : attendanceStatus === 'yes'
      ? 'rounded-full px-2.5 py-0.5 text-xs font-semibold text-white bg-green-600 border border-green-500/50 shrink-0'
      : attendanceStatus === 'no'
        ? 'rounded-full px-2.5 py-0.5 text-xs font-semibold text-white bg-red-700 border border-red-600/50 shrink-0'
        : 'rounded-full px-2.5 py-0.5 text-xs font-semibold text-white border border-white/40 bg-white/10 hover:bg-white/20 shrink-0 transition-colors';

  const attendanceChipLabel = isTrainingCard
    ? attendanceStatus === 'no'
      ? 'Abwesend'
      : 'Dabei'
    : attendanceStatus === 'yes'
      ? 'Zugesagt'
      : attendanceStatus === 'no'
        ? 'Abgesagt'
        : 'Zu-/Absage';

  const showAttendanceCounts = canManage && attendanceCounts != null;

  const compactParentRow = showAttendanceChip && !showAttendanceCounts && !showManageButtons;
  const dateRow = (
    <div className="mb-2">
      <div className={`${compactParentRow ? 'flex items-center justify-between gap-2' : ''}`}>
      <span className="block text-base font-semibold text-white min-w-0 truncate">
        {date ? dateLabelShort : ''}
      </span>
      <div className={`${compactParentRow ? '' : 'mt-1.5'} flex items-center gap-1.5 shrink-0 flex-wrap justify-end`} onClick={(e) => e.stopPropagation()}>
        {showAttendanceCounts && (
          isTrainingCard ? (
            <div className="flex items-center gap-1.5" aria-label="Trainings-Teilnahme">
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-600/20 text-red-400 border border-red-500/40 whitespace-nowrap" title="Abwesend">
                {attendanceCounts.no}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-green-600/20 text-green-400 border border-green-500/40 whitespace-nowrap" title="Dabei">
                {attendanceCounts.yes + attendanceCounts.open}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5" aria-label="Zu-/Absagen">
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-green-600/20 text-green-400 border border-green-500/40 whitespace-nowrap" title="Zugesagt">
                {attendanceCounts.yes}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-600/20 text-red-400 border border-red-500/40 whitespace-nowrap" title="Abgesagt">
                {attendanceCounts.no}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-gray-600/20 text-gray-400 border border-gray-500/30 whitespace-nowrap" title="Offen">
                {attendanceCounts.open}
              </span>
            </div>
          )
        )}
        {showManageButtons && (
          <>
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="rounded-full bg-red-700/80 px-2.5 py-0.5 text-xs text-white shrink-0"
              >
                Bearbeiten
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
          onClick={(e) => { e.stopPropagation(); onOpenAttendance?.(); }}
          className={attendanceChipClass}
        >
          {attendanceChipLabel}
        </button>
        )}
      </div>
      </div>
    </div>
  );

  const cardContent = (
    <>
      {/* Spielart: weiß, font-medium */}
      {headerTitle && (
        <div className="flex justify-center">
          <p className="text-xl font-semibold text-white">
            {headerTitle}
          </p>
        </div>
      )}

      {effectiveEventType === 'game' ? (
        <MatchCardGameCore
          headerTitle={headerTitle}
          leftName={leftName}
          rightName={rightName}
          opponentLogoUrl={rightLogoOverride}
          timeDisplay={timeStr}
          isMatch={isMatch}
          showScore={showScore}
          homeScore={home}
          awayScore={away}
          kickoffLocation={locationForKickoff}
          meetupTimeOnly={meetupTimeOnly}
          showMeetupPill={Boolean(canSeeSensitiveInfo && meetupTimeOnly)}
          endTimeLabel={endTimeLabel}
          descriptionText={descriptionText}
          variant="schedule"
        />
      ) : (
        <>
          {/* TRAINING / EVENT: kein Team-/Opponent-Grid, dafür kompakte Pills/Badges */}
          <div className="mt-4 flex flex-col items-center text-center gap-2">
            <MatchCardKickoffBlock
              timeDisplay={timeStr}
              showUhr
              location={null}
              headerLabel="BEGINN"
            />

            {placeLine ? (
              <div className="mt-1 flex min-h-9 max-w-[320px] items-center justify-center rounded-full bg-white/10 border border-white/15 px-5 py-2 text-sm font-medium text-white/90">
                <span className="break-words line-clamp-2">{placeLine}</span>
              </div>
            ) : null}
            {addressLine && addressLine.toLowerCase() !== placeLine.toLowerCase() ? (
              <div className="mt-1 flex min-h-9 max-w-[320px] items-center justify-center rounded-full bg-white/5 border border-white/10 px-5 py-2 text-xs font-medium text-white/80">
                <span className="break-words line-clamp-3 text-center">{addressLine}</span>
              </div>
            ) : null}

            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {canSeeSensitiveInfo && meetupTimeOnly ? (
                <div className="flex h-9 max-w-[320px] items-center justify-center rounded-full bg-red-800/80 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800/90">
                  <span className="whitespace-nowrap">Treffpunkt: {meetupTimeOnly}</span>
                </div>
              ) : null}

              {endTimeLabel ? (
                <div className="flex h-9 max-w-[320px] items-center justify-center rounded-full bg-white/10 border border-white/15 px-5 py-2 text-sm font-medium text-white/90">
                  <span className="whitespace-nowrap">Ende: {endTimeLabel}</span>
                </div>
              ) : null}
            </div>

            {descriptionText ? (
              <div className="mt-1 text-[13px] leading-snug text-white/75 font-semibold line-clamp-2 max-w-[320px]">
                {descriptionText}
              </div>
            ) : null}
          </div>
        </>
      )}
    </>
  );

  const baseCardClass =
    `relative w-full max-w-none overflow-hidden rounded-2xl bg-gradient-to-b from-black to-red-900 px-[15px] py-4 ${className}`;
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
