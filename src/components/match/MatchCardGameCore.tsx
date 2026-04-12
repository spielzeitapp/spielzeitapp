import React from 'react';
import { getClubLogoUrl } from '../../utils/logoResolver';
import { splitCombinedLocation } from '../../lib/eventLocation';

/** Logo-URL aus Anzeige-Namen; optional Storage-URL. */
function getLogoSrcForDisplayName(displayName: string, optionalUrl?: string | null): string {
  if (optionalUrl && typeof optionalUrl === 'string' && optionalUrl.trim().startsWith('http'))
    return optionalUrl.trim();
  return getClubLogoUrl(displayName);
}

/** Erstes Token = prefix, Rest = name. */
function splitPrefixAndName(full: string): { prefix: string; name: string } {
  const trimmed = (full || '').trim();
  const i = trimmed.indexOf(' ');
  if (i === -1) return { prefix: '', name: trimmed };
  return { prefix: trimmed.slice(0, i), name: trimmed.slice(i + 1) };
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
    ? 'mt-2 text-[15px] sm:text-base font-bold text-white text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-[132px] sm:max-w-[152px] leading-tight'
    : 'mt-1 text-[15px] font-semibold text-white text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]';
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={`${imgClass} mx-auto object-contain`}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className={`${imgClass} mx-auto rounded-2xl border border-white/10 bg-white/[0.06]`} />
      )}
      {prefix ? (
        <div className={`${hero ? 'mt-2 text-[11px] sm:text-xs' : 'mt-2 text-[14px]'} font-semibold uppercase tracking-wide text-white/55`}>
          {prefix}
        </div>
      ) : null}
      <div className={nameClass}>{name || '–'}</div>
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
};

/** Für Training/Event-Zeile in derselben Karte (Termine). */
export function MatchCardKickoffBlock({
  timeDisplay,
  showUhr,
  location,
  headerLabel,
  subtitleAboveHeader,
  hero,
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
          hero ? 'text-[10px] sm:text-[11px] tracking-[0.42em]' : 'text-[14px] tracking-[0.35em]'
        } font-bold uppercase text-red-400/95`}
      >
        {headerLabel ?? 'ANPFIFF'}
      </div>
      <div className={timeClass}>{timeDisplay}</div>
      {showUhr ? <div className="mt-1 text-white font-medium">Uhr</div> : null}
      {hasLocation ? (
        <div className="mt-1 text-[14px] font-medium text-white/95 leading-tight text-center break-words line-clamp-3 min-w-0 max-w-[220px]">
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
}: MatchCardGameCoreProps) {
  const hero = variant === 'home-hero';
  const leftSplit = splitPrefixAndName(leftName ?? '');
  const rightSplit = splitPrefixAndName(rightName ?? '');
  const leftLogoUrl = getLogoSrcForDisplayName(leftName ?? '', null);
  const rightLogoUrl = getLogoSrcForDisplayName(rightName ?? '', opponentLogoUrl ?? null);

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
        className={`${gridMt} grid grid-cols-[1fr_auto_1fr] items-center ${gridGap} ${hero ? 'min-h-[140px] sm:min-h-[160px]' : ''}`}
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

        <div className="flex min-w-0 flex-col items-center px-1 text-center sm:px-3">
          <MatchCardKickoffBlock
            timeDisplay={isMatch && showScore ? `${homeScore} : ${awayScore}` : timeDisplay}
            showUhr={!isMatch || !showScore}
            location={kickoffLocation}
            headerLabel="ANPFIFF"
            subtitleAboveHeader={kickoffSubtitleAboveHeader}
            hero={hero}
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
