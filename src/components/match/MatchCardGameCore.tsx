import React from 'react';
import { getClubLogoUrl, isValidLogoUrl } from '../../utils/logoResolver';
import { splitCombinedLocation } from '../../lib/eventLocation';

/** Logo-URL aus Anzeige-Namen; optional Storage-URL. */
function getLogoSrcForDisplayName(displayName: string, optionalUrl?: string | null): string {
  if (isValidLogoUrl(optionalUrl))
    return optionalUrl.trim();
  return getClubLogoUrl(displayName);
}

function tokenLooksLikeAbbrev(token: string): boolean {
  const t = (token || '').trim();
  if (t.length < 2 || t.length > 8) return false;
  const plain = t.replace(/\./g, '');
  if (plain.length < 2) return false;
  if (/^[A-Z0-9.]+$/.test(t) && plain.length <= 6) return true;
  return /^[A-ZÄÖÜ]{2,6}$/.test(t);
}

/** Teamanzeige: oben Kürzel, unten Vereins-/Ortsname; unterstützt Präfix oder Suffix. */
function splitPrefixAndName(full: string): { prefix: string; name: string } {
  const trimmed = (full || '').trim();
  if (!trimmed) return { prefix: '', name: '' };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { prefix: '', name: trimmed };
  const first = parts[0];
  const last = parts[parts.length - 1];
  const firstIsAbbrev = tokenLooksLikeAbbrev(first);
  const lastIsAbbrev = tokenLooksLikeAbbrev(last);
  if (firstIsAbbrev && !lastIsAbbrev) return { prefix: first, name: parts.slice(1).join(' ') };
  if (lastIsAbbrev && !firstIsAbbrev) return { prefix: last, name: parts.slice(0, -1).join(' ') };
  return { prefix: first, name: parts.slice(1).join(' ') };
}

/** Spielort heuristisch in bis zu 3 Zeilen aufteilen. */
function formatLocationLines(loc: string): { line1: string; line2: string | null; line3: string | null } {
  const s = (loc ?? '').trim();
  if (!s) return { line1: '', line2: null, line3: null };
  if (s.includes('\n')) {
    const parsed = splitCombinedLocation(s);
    if (!parsed.place && parsed.address) return { line1: parsed.address, line2: null, line3: null };
    const parts = parsed.address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return { line1: parsed.place, line2: parts[0], line3: parts.slice(1).join(', ') };
    return { line1: parsed.place, line2: parsed.address || null, line3: null };
  }
  const commaParts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    return {
      line1: commaParts[0],
      line2: commaParts[1],
      line3: commaParts.slice(2).join(', '),
    };
  }
  if (commaParts.length === 2) return { line1: commaParts[0], line2: commaParts[1], line3: null };
  const prefix = 'Sportplatz ';
  if (s.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = s.slice(prefix.length).trim();
    return { line1: 'Sportplatz', line2: rest || null, line3: null };
  }
  return { line1: s, line2: null, line3: null };
}

type TeamBlockProps = {
  logoUrl?: string | null;
  prefix?: string;
  name: string;
  hero?: boolean;
};

function TeamBlock({ logoUrl, prefix, name, hero }: TeamBlockProps) {
  const imgClass = hero ? 'h-[52px] w-[52px] sm:h-[60px] sm:w-[60px]' : 'h-12 w-12 sm:h-14 sm:w-14';
  const nameClass = hero
    ? 'mt-1 w-full max-w-[min(200px,46vw)] text-[17px] font-bold leading-snug text-white min-[390px]:text-[17px] sm:max-w-[220px] sm:text-[17px]'
    : 'mt-0.5 max-w-[184px] text-[17px] font-semibold leading-snug text-white sm:max-w-[200px]';
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={`${imgClass} mx-auto object-contain`}
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
              if (img.src.endsWith('/logos/placeholder-shield-a.png')) return;
              img.src = '/logos/placeholder-shield-a.png';
          }}
        />
      ) : (
        <img src="/logos/placeholder-shield-a.png" alt="" className={`${imgClass} mx-auto object-contain`} />
      )}
      {prefix ? (
        <div className={`${hero ? 'mt-1.5 text-[12px]' : 'mt-1.5 text-[12px]'} font-semibold uppercase tracking-[0.14em] text-white/90`}>
          {prefix}
        </div>
      ) : null}
      <div className={nameClass}>
        <span className="line-clamp-2 block break-normal [overflow-wrap:normal] [text-wrap:balance]">{name || 'Team'}</span>
      </div>
    </div>
  );
}

type KickoffBlockProps = {
  timeDisplay: string;
  showUhr: boolean;
  location: string | null | undefined;
  headerLabel?: string;
  /** Eine Zeile direkt oberhalb von `headerLabel` (z. B. Spielart aus `match_type`). */
  subtitleAboveHeader?: string | null;
  hero?: boolean;
  /** Zwischen „Uhr“ und Ort: dezentes „VS“ (nur Termine-Hero / Spiel). */
  centerVs?: boolean;
};

/** Für Training/Event-Zeile in derselben Karte (Termine). */
export function MatchCardKickoffBlock({
  timeDisplay,
  showUhr,
  location,
  headerLabel,
  subtitleAboveHeader,
  hero,
  centerVs,
}: KickoffBlockProps) {
  const hasLocation = location != null && location.trim() !== '';
  const locationLines = hasLocation
    ? formatLocationLines(location)
    : { line1: '', line2: null as string | null, line3: null as string | null };

  const timeClass = hero
    ? 'mt-3 text-[2.75rem] sm:text-[3.35rem] font-black leading-none tracking-tight text-white tabular-nums drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]'
    : 'mt-2 text-[34px] sm:text-[44px] font-extrabold leading-[1] text-white tabular-nums';

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {subtitleAboveHeader ? (
        <div
          className={
            hero
              ? 'mb-1 max-w-[min(220px,85vw)] text-base font-semibold leading-tight text-white sm:text-lg'
              : 'mb-0.5 max-w-[200px] text-[15px] font-semibold leading-tight text-white sm:text-base'
          }
        >
          {subtitleAboveHeader}
        </div>
      ) : null}
      <div
        className={`${
          hero ? 'text-[9px] sm:text-[10px] tracking-[0.4em]' : 'text-[12px] tracking-[0.3em]'
        } font-bold uppercase text-red-400/95`}
      >
        {headerLabel ?? 'ANPFIFF'}
      </div>
      <div className={timeClass}>{timeDisplay}</div>
      {showUhr ? <div className="mt-1 text-white font-medium">Uhr</div> : null}
      {centerVs ? (
        <div
          className="mt-2 text-[10px] font-black uppercase tracking-[0.38em] text-red-400/45 sm:text-[11px]"
          aria-hidden
        >
          vs
        </div>
      ) : null}
      {hasLocation ? (
        <div
          className={`mt-1 text-[14px] font-medium text-white/95 leading-tight text-center break-words line-clamp-3 min-w-0 ${
            hero ? 'max-w-[min(280px,min(92vw,100%))]' : 'max-w-[220px]'
          }`}
        >
          {locationLines.line2 ? (
            <>
              {locationLines.line1}
              <br />
              {locationLines.line2}
              {locationLines.line3 ? (
                <>
                  <br />
                  {locationLines.line3}
                </>
              ) : null}
            </>
          ) : (
            locationLines.line1 || location!.trim()
          )}
        </div>
      ) : null}
    </div>
  );
}

export type MatchCardGameCoreProps = {
  headerTitle: string | null;
  leftName: string;
  rightName: string;
  opponentLogoUrl?: string | null;
  timeDisplay: string;
  isMatch: boolean;
  showScore: boolean;
  homeScore: number;
  awayScore: number;
  /** Ort unter der Anpfiff-Zeit (null = nur Zeit, z. B. Home-Hero) */
  kickoffLocation: string | null;
  meetupTimeOnly: string;
  showMeetupPill: boolean;
  endTimeLabel?: string | null;
  descriptionText?: string | null;
  variant?: 'schedule' | 'home-hero';
  /** Nur home-hero: kleine Spalten-Überschriften (z. B. Heim / Gegner). */
  leftColumnLabel?: string;
  rightColumnLabel?: string;
  /** Termine: Spielart (`match_type`) direkt oberhalb „ANPFIFF“ in der Mittelspalte. */
  kickoffSubtitleAboveHeader?: string | null;
  /** Optionales Label in der Mittelspalte (z. B. ENDSTAND statt ANPFIFF). */
  kickoffHeaderLabel?: string | null;
  /** Nur großer Hero: „vs.“ zwischen Uhrzeit und Ort. */
  showCenterVs?: boolean;
  /** Wenn gesetzt, steuert „Uhr“ unter der Anpfiff-Zeit (sonst: nur bei Spiel ohne Ergebnis). */
  kickoffShowUhr?: boolean;
};

/**
 * Gemeinsamer 3-Spalten-Spielblock (Heim | Anpfiff | Gegner) wie Termine-Karte.
 * Ohne Datum-Zeile, ohne Karten-Rahmen — nur innerer Inhalt.
 */
export function MatchCardGameCore({
  headerTitle,
  leftName,
  rightName,
  opponentLogoUrl,
  timeDisplay,
  isMatch,
  showScore,
  homeScore,
  awayScore,
  kickoffLocation,
  meetupTimeOnly,
  showMeetupPill,
  endTimeLabel,
  descriptionText,
  variant = 'schedule',
  leftColumnLabel,
  rightColumnLabel,
  kickoffSubtitleAboveHeader,
  kickoffHeaderLabel,
  showCenterVs,
  kickoffShowUhr,
}: MatchCardGameCoreProps) {
  const safeLeftName = (leftName || '').trim() || 'Team';
  const safeRightName = (rightName || '').trim() || 'Gegner';
  const hero = variant === 'home-hero';
  const leftSplit = splitPrefixAndName(safeLeftName);
  const rightSplit = splitPrefixAndName(safeRightName);
  const leftLogoUrl = getLogoSrcForDisplayName(safeLeftName, null);
  const rightLogoUrl = getLogoSrcForDisplayName(safeRightName, opponentLogoUrl ?? null);

  const gridMt = hero ? 'mt-8' : 'mt-4';
  const gridGap = hero ? 'gap-x-2 sm:gap-x-4' : 'gap-x-4';
  const meetupMt = hero ? 'mt-6' : 'mt-5';

  return (
    <>
      {headerTitle ? (
        <div className="flex justify-center">
          <p
            className={
              hero
                ? 'text-lg font-semibold tracking-tight text-white/95 sm:text-xl'
                : 'text-xl font-semibold text-white'
            }
          >
            {headerTitle}
          </p>
        </div>
      ) : null}

      <div
        className={`${gridMt} grid grid-cols-[1.02fr_auto_1.02fr] items-center ${gridGap} ${
          hero ? 'min-h-[140px] sm:min-h-[160px]' : ''
        }`}
      >
        <div className="flex min-w-0 flex-col items-center border-r border-white/[0.12] py-2 pr-3 text-center sm:pr-5">
          {hero && leftColumnLabel ? (
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">{leftColumnLabel}</p>
          ) : null}
          <TeamBlock
            logoUrl={leftLogoUrl}
            prefix={leftSplit.prefix || undefined}
            name={leftSplit.name || '–'}
            hero={hero}
          />
        </div>

        <div
          className={`flex min-w-0 flex-col items-center px-0.5 text-center sm:px-1 ${
            hero
              ? 'max-w-[min(300px,min(94vw,100%))]'
              : 'max-w-[118px] sm:max-w-[134px]'
          }`}
        >
          <MatchCardKickoffBlock
            timeDisplay={isMatch && showScore ? `${homeScore} : ${awayScore}` : timeDisplay}
            showUhr={kickoffShowUhr ?? (!isMatch || !showScore)}
            location={kickoffLocation}
            headerLabel={kickoffHeaderLabel ?? 'ANPFIFF'}
            subtitleAboveHeader={kickoffSubtitleAboveHeader}
            hero={hero}
            centerVs={Boolean(hero && showCenterVs)}
          />
        </div>

        <div className="flex min-w-0 flex-col items-center border-l border-white/[0.12] py-2 pl-3 text-center sm:pl-5">
          {hero && rightColumnLabel ? (
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">{rightColumnLabel}</p>
          ) : null}
          <TeamBlock
            logoUrl={rightLogoUrl}
            prefix={rightSplit.prefix || undefined}
            name={rightSplit.name || '–'}
            hero={hero}
          />
        </div>
      </div>

      <div className={`${meetupMt} flex min-h-[36px] justify-center`}>
        {showMeetupPill && meetupTimeOnly ? (
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
  );
}
