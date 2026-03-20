import React from 'react';
import { getClubLogoUrl } from '../../utils/logoResolver';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import type { EventKind, EventStatus } from '../../hooks/useEvents';
import { formatFullLocation } from '../../lib/eventLocation';

/** Spielart (match_type) → Anzeige-Label. */
const MATCH_TYPE_LABELS: Record<string, string> = {
  league: 'Meisterschaftsspiel',
  friendly: 'Freundschaftsspiel',
  tournament: 'Turnier',
  test: 'Testspiel',
  cup: 'Pokal',
  other: 'Sonstiges',
};

function getMatchTypeLabel(matchType: string | null | undefined): string | null {
  if (!matchType || !matchType.trim()) return null;
  const key = matchType.trim().toLowerCase();
  return MATCH_TYPE_LABELS[key] ?? matchType;
}

/** Wochentag kurz für DE (Sa., So., Mo., …). */
const WEEKDAY_SHORT_DE: Record<number, string> = {
  0: 'So.',
  1: 'Mo.',
  2: 'Di.',
  3: 'Mi.',
  4: 'Do.',
  5: 'Fr.',
  6: 'Sa.',
};

/** Datum kurz: "Sa. 06.06.2026" (ohne Beistrich). */
function formatDateShortDE(date: Date): string {
  const w = date.getDay();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${WEEKDAY_SHORT_DE[w] ?? ''} ${day}.${month}.${year}`;
}

/** Treffpunkt-Datum → nur Uhrzeit "HH:mm Uhr". */
function formatMeetupTimeOnly(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

/** Erstes Token = prefix, Rest = name. Kein Leerzeichen → prefix="", name=kompletter String. */
function splitPrefixAndName(full: string): { prefix: string; name: string } {
  const trimmed = (full || '').trim();
  const i = trimmed.indexOf(' ');
  if (i === -1) return { prefix: '', name: trimmed };
  return { prefix: trimmed.slice(0, i), name: trimmed.slice(i + 1) };
}

/** Spielort: Zeile 1 "Sportplatz", Zeile 2 Ortsname (kein Buchstaben-Umbruch). */
function formatLocationLines(loc: string): { line1: string; line2: string | null } {
  const s = (loc ?? '').trim();
  if (!s) return { line1: '', line2: null };
  const prefix = 'Sportplatz ';
  if (s.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = s.slice(prefix.length).trim();
    return { line1: 'Sportplatz', line2: rest || null };
  }
  return { line1: s, line2: null };
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

/** Logo-URL aus Anzeige-Namen (slugify nur für Pfad); Anzeige-Name bleibt unverändert. */
function getLogoSrcForDisplayName(displayName: string, optionalUrl?: string | null): string {
  if (optionalUrl && typeof optionalUrl === 'string' && optionalUrl.trim().startsWith('http'))
    return optionalUrl.trim();
  return getClubLogoUrl(displayName);
}

/** TeamBlock: Logo + Prefix + Vereinsname, mittig, responsive (Mobile kompakt). */
type TeamBlockProps = {
  logoUrl?: string | null;
  prefix?: string;
  name: string;
};

function TeamBlock({ logoUrl, prefix, name }: TeamBlockProps) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className="h-12 w-12 sm:h-14 sm:w-14 object-contain mx-auto"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white/10 mx-auto" />
      )}
      {prefix ? (
        <div className="mt-2 text-[14px] font-semibold text-white tracking-wide">
          {prefix}
        </div>
      ) : null}
      <div className="mt-1 text-[15px] font-semibold text-white text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
        {name || '–'}
      </div>
    </div>
  );
}

/** KickoffBlock: ANPFIFF + Zeit + Uhr + Spielort, zentriert, responsive. */
type KickoffBlockProps = {
  timeDisplay: string;
  showUhr: boolean;
  location: string | null | undefined;
  headerLabel?: string;
};

function KickoffBlock({ timeDisplay, showUhr, location, headerLabel }: KickoffBlockProps) {
  const hasLocation = location != null && location.trim() !== '';
  const locationLines = hasLocation ? formatLocationLines(location) : { line1: '', line2: null as string | null };

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className="text-[14px] tracking-[0.35em] text-red-300 font-semibold">
        {headerLabel ?? 'ANPFIFF'}
      </div>
      <div className="mt-2 text-[34px] sm:text-[44px] font-extrabold leading-[1] text-white tabular-nums">
        {timeDisplay}
      </div>
      {showUhr ? (
        <div className="mt-1 text-white font-medium">Uhr</div>
      ) : null}
      {hasLocation ? (
        <div className="mt-1 text-[15px] font-medium text-white leading-tight text-center break-words line-clamp-2 min-w-0 max-w-[200px]">
          {locationLines.line2 ? (
            <>
              {locationLines.line1}
              <br />
              {locationLines.line2}
            </>
          ) : (
            locationLines.line1 || location.trim()
          )}
        </div>
      ) : null}
    </div>
  );
}

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
  const meetupTimeOnly = formatMeetupTimeOnly(meetupAt);
  const locationForKickoff = formatFullLocation(location, address) || null;

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
    ? date.toLocaleDateString('de-AT', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;
  const dateLabelShort = date ? formatDateShortDE(date) : null;
  const timeStr = date
    ? date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
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

  const leftSplit = splitPrefixAndName(leftName ?? '');
  const rightSplit = splitPrefixAndName(rightName ?? '');
  const homePrefix = leftSplit.prefix;
  const homeName = leftSplit.name;
  const awayPrefix = rightSplit.prefix;
  const awayName = rightSplit.name;
  const homeLogoUrl = getLogoSrcForDisplayName(leftName ?? '', null);
  const awayLogoUrl = getLogoSrcForDisplayName(rightName ?? '', rightLogoOverride);

  const showManageButtons = canManage && (onEdit || onDelete);
  const showAttendanceChip = (role === 'parent' || role === 'player') && onOpenAttendance;

  /* Pill wie Bearbeiten/Löschen: gleiche Höhe/Radius (rounded-full px-3 py-1 text-sm), farblich passend */
  const attendanceChipClass = isTrainingCard
    ? attendanceStatus === 'no'
      ? 'rounded-full px-3 py-1 text-sm font-semibold text-white bg-red-700 border border-red-600/50 shrink-0'
      : 'rounded-full px-3 py-1 text-sm font-semibold text-white bg-green-600 border border-green-500/50 shrink-0'
    : attendanceStatus === 'yes'
      ? 'rounded-full px-3 py-1 text-sm font-semibold text-white bg-green-600 border border-green-500/50 shrink-0'
      : attendanceStatus === 'no'
        ? 'rounded-full px-3 py-1 text-sm font-semibold text-white bg-red-700 border border-red-600/50 shrink-0'
        : 'rounded-full px-3 py-1 text-sm font-semibold text-white border border-white/40 bg-white/10 hover:bg-white/20 shrink-0 transition-colors';

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

  const dateRow = (
    <div className="flex items-center justify-between gap-2 mb-3">
      <span className="text-lg font-semibold text-white whitespace-nowrap min-w-0 truncate">
        {date ? dateLabelShort : ''}
      </span>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
        {showAttendanceCounts && (
          isTrainingCard ? (
            <div className="flex items-center gap-1.5" aria-label="Trainings-Teilnahme">
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/40 whitespace-nowrap" title="Abwesend">
                {attendanceCounts.no}
              </span>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/40 whitespace-nowrap" title="Dabei">
                {attendanceCounts.yes + attendanceCounts.open}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5" aria-label="Zu-/Absagen">
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/40 whitespace-nowrap" title="Zugesagt">
                {attendanceCounts.yes}
              </span>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/40 whitespace-nowrap" title="Abgesagt">
                {attendanceCounts.no}
              </span>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-600/20 text-gray-400 border border-gray-500/30 whitespace-nowrap" title="Offen">
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
                className="rounded-full bg-red-700 px-3 py-1 text-sm text-white shrink-0"
              >
                Bearbeiten
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="rounded-full bg-red-800 px-3 py-1 text-sm text-white shrink-0"
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
        <>
          {/* ANPFIFF-Block: 1fr_auto_1fr, Mitte nie verschoben, Mobile kompakt */}
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4">
            <div className="min-w-0 flex flex-col items-center text-center">
              <TeamBlock
                logoUrl={homeLogoUrl}
                prefix={homePrefix || undefined}
                name={homeName || '–'}
              />
            </div>

            <div className="min-w-0 flex flex-col items-center text-center">
              <KickoffBlock
                timeDisplay={isMatch && showScore ? `${home} : ${away}` : timeStr}
                showUhr={!isMatch || !showScore}
                location={locationForKickoff}
                headerLabel="ANPFIFF"
              />
            </div>

            <div className="min-w-0 px-2 flex flex-col items-center text-center">
              <TeamBlock
                logoUrl={awayLogoUrl}
                prefix={awayPrefix || undefined}
                name={awayName || '–'}
              />
            </div>
          </div>

          {/* Treffpunkt: sekundärer CTA, einheitliche Höhe damit kein Layout-Sprung */}
          <div className="mt-5 flex min-h-[36px] justify-center">
            {canSeeSensitiveInfo && meetupTimeOnly ? (
              <div className="flex h-9 max-w-[320px] items-center justify-center rounded-full bg-red-800/80 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800/90">
                <span className="whitespace-nowrap">Treffpunkt: {meetupTimeOnly}</span>
              </div>
            ) : null}
          </div>

              {endTimeLabel ? (
                <div className="mt-2 flex min-h-[36px] justify-center">
                  <div className="flex h-9 max-w-[320px] items-center justify-center rounded-full bg-white/10 border border-white/15 px-5 py-2 text-sm font-medium text-white/90">
                    <span className="whitespace-nowrap">Ende: {endTimeLabel}</span>
                  </div>
                </div>
              ) : null}

              {descriptionText ? (
                <div className="mt-2 text-[13px] leading-snug text-white/75 font-semibold line-clamp-2 max-w-[320px]">
                  {descriptionText}
                </div>
              ) : null}
        </>
      ) : (
        <>
          {/* TRAINING / EVENT: kein Team-/Opponent-Grid, dafür kompakte Pills/Badges */}
          <div className="mt-4 flex flex-col items-center text-center gap-2">
            <KickoffBlock
              timeDisplay={timeStr}
              showUhr
              location={null}
              headerLabel="BEGINN"
            />

            {location?.trim() ? (
              <div className="mt-1 flex min-h-9 max-w-[320px] items-center justify-center rounded-full bg-white/10 border border-white/15 px-5 py-2 text-sm font-medium text-white/90">
                <span className="break-words line-clamp-2">{location.trim()}</span>
              </div>
            ) : null}
            {address?.trim() ? (
              <div className="mt-1 flex min-h-9 max-w-[320px] items-center justify-center rounded-full bg-white/5 border border-white/10 px-5 py-2 text-xs font-medium text-white/80">
                <span className="break-words line-clamp-3 text-center">{address.trim()}</span>
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
