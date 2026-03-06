import React from 'react';
import { getClubLogoUrl } from '../../utils/logoResolver';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import type { EventKind, EventStatus } from '../../hooks/useEvents';

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
  matchType?: string | null;
  location?: string | null;
  meetupAt?: string | null;
  /** true = Treffpunkt anzeigen (canSeeMeetup). Spielort ist immer sichtbar. */
  showMeetup?: boolean;
  scoreHome?: number | null;
  scoreAway?: number | null;
  className?: string;
  eventId?: string | null;
  onNavigate?: (eventId: string) => void;
  opponentSlug?: string | null;
  opponentLogoUrl?: string | null;
  /** Nur für Trainer/Admin: Bearbeiten + Löschen anzeigen. Buttons stoppen Card-Klick. */
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

/** Logo-URL aus Anzeige-Namen (slugify nur für Pfad); Anzeige-Name bleibt unverändert. */
function getLogoSrcForDisplayName(displayName: string, optionalUrl?: string | null): string {
  if (optionalUrl && typeof optionalUrl === 'string' && optionalUrl.trim().startsWith('http'))
    return optionalUrl.trim();
  return getClubLogoUrl(displayName);
}

/** TeamBlock: Logo + Prefix + Vereinsname. Kompakt, mittig in der Spalte. */
type TeamBlockProps = {
  logoUrl?: string | null;
  short?: string;
  nameLine1?: string;
  nameLine2?: string;
};

function TeamBlock({ logoUrl, short, nameLine1 = '', nameLine2 }: TeamBlockProps) {
  const logoCls = 'mx-auto h-14 w-14 object-contain drop-shadow-sm';
  const nameDisplay = nameLine2 ? `${nameLine1} ${nameLine2}`.trim() : nameLine1;

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={nameDisplay || short || ''}
          className={logoCls}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className={`${logoCls} rounded-full bg-white/5`} />
      )}

      {short ? (
        <div className="mt-2 text-[14px] font-medium tracking-widest text-white opacity-70">
          {short}
        </div>
      ) : null}

      <div className="mt-1 max-w-[150px] text-[22px] font-semibold leading-[1.05] text-white break-words text-center hyphens-auto">
        {nameDisplay || '–'}
      </div>
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
  matchType,
  location,
  meetupAt,
  showMeetup,
  scoreHome,
  scoreAway,
  className = '',
  eventId,
  onNavigate,
  opponentSlug,
  opponentLogoUrl,
  canManage,
  onEdit,
  onDelete,
}) => {
  const ourClubName = getOurTeamDisplayName();
  const canSeeSensitiveInfo = showMeetup;
  const matchTypeLabel = getMatchTypeLabel(matchType);
  const meetupTimeOnly = formatMeetupTimeOnly(meetupAt);

  let leftName: string;
  let rightName: string;

  if (kind === 'training') {
    leftName = ourClubName;
    rightName = 'Training';
  } else if (kind === 'event') {
    leftName = ourClubName;
    rightName = opponent ?? 'Termin';
  } else {
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
  const isMatch = kind === 'match';

  const handleCardClick = () => {
    if (eventId && onNavigate) onNavigate(eventId);
  };

  const isClickable = Boolean(eventId && onNavigate);
  const rightLogoOverride =
    opponentLogoUrl ?? (opponentSlug ? getClubLogoUrl(opponentSlug) : null);

  const leftSplit = splitPrefixAndName(leftName ?? '');
  const rightSplit = splitPrefixAndName(rightName ?? '');
  const homePrefix = leftSplit.prefix;
  const homeName = leftSplit.name;
  const awayPrefix = rightSplit.prefix;
  const awayName = rightSplit.name;
  const homeLogoUrl = getLogoSrcForDisplayName(leftName ?? '', null);
  const awayLogoUrl = getLogoSrcForDisplayName(rightName ?? '', rightLogoOverride);

  const dateRow = (
    <div className="flex items-center justify-between mb-3">
      <span className="text-lg font-semibold text-white whitespace-nowrap">
        {date ? dateLabelShort : ''}
      </span>
      {canManage && (onEdit || onDelete) && (
        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
        </div>
      )}
    </div>
  );

  const cardContent = (
    <>
      {/* Spielart: weiß, font-medium */}
      {matchTypeLabel && (
        <div className="flex justify-center">
          <p className="text-xl font-semibold text-white">
            {matchTypeLabel}
          </p>
        </div>
      )}

      {/* ANPFIFF-Block: kompakt, Mitte zentriert, 120px-Teamspalten */}
      <div className={`grid grid-cols-[120px_1fr_120px] items-start gap-x-3 ${matchTypeLabel ? 'mt-6' : 'mt-4'}`}>
        {/* HOME */}
        <div className="min-w-0 flex flex-col items-center text-center">
          {homeLogoUrl ? (
            <img
              src={homeLogoUrl}
              alt=""
              className="h-12 w-12 object-contain drop-shadow"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-white/10" />
          )}

          <div className="mt-2 text-[13px] font-medium tracking-widest uppercase opacity-70 text-white">
            {homePrefix}
          </div>

          <div
            className="mt-1 max-w-[120px] text-[20px] font-semibold leading-[1.05] text-white hyphens-none break-words text-center line-clamp-2"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
          >
            {homeName || '–'}
          </div>
        </div>

        {/* CENTER */}
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="text-[16px] font-semibold tracking-[0.35em] text-red-200/90">
            ANPFIFF
          </div>

          <div className="mt-1 text-[32px] sm:text-[36px] font-extrabold leading-none text-white tabular-nums">
            {isMatch && showScore ? `${home} : ${away}` : timeStr}
          </div>

          {!isMatch || !showScore ? (
            <div className="mt-1 text-[15px] text-white opacity-70">Uhr</div>
          ) : null}

          {location && location.trim() ? (() => {
            const { line1, line2 } = formatLocationLines(location);
            const venueLine1 = line1 || '';
            const venueLine2 = line2 ?? '';
            return (
              <div className="mt-1 text-[15px] leading-tight text-white opacity-80 text-center">
                {venueLine1}{venueLine2 ? <><br />{venueLine2}</> : null}
              </div>
            );
          })() : null}
        </div>

        {/* AWAY */}
        <div className="min-w-0 flex flex-col items-center text-center">
          {awayLogoUrl ? (
            <img
              src={awayLogoUrl}
              alt=""
              className="h-12 w-12 object-contain drop-shadow"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-white/10" />
          )}

          <div className="mt-2 text-[13px] font-medium tracking-widest uppercase opacity-70 text-white">
            {awayPrefix}
          </div>

          <div
            className="mt-1 max-w-[120px] text-[20px] font-semibold leading-[1.05] text-white hyphens-none break-words text-center line-clamp-2"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
          >
            {awayName || '–'}
          </div>
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
    </>
  );

  const cardClass =
    `relative w-full max-w-none overflow-hidden rounded-2xl bg-gradient-to-b from-black to-red-900 px-[15px] py-4 ${isClickable ? 'cursor-pointer transition ' : ''}${className}`;

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
      aria-label={`Spiel ${leftName} gegen ${rightName}, ${dateLabelLong ?? dateLabelShort ?? ''} ${timeStr}`}
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
};
