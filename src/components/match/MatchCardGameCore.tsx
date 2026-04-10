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
  const imgClass = hero ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-12 w-12 sm:h-14 sm:w-14';
  const nameClass = hero
    ? 'mt-1 text-[16px] sm:text-[17px] font-semibold text-white text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] sm:max-w-[160px]'
    : 'mt-1 text-[15px] font-semibold text-white text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]';
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={`${imgClass} object-contain mx-auto`}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className={`${imgClass} rounded-full bg-white/10 mx-auto`} />
      )}
      {prefix ? (
        <div className={`mt-2 ${hero ? 'text-[15px]' : 'text-[14px]'} font-semibold text-white tracking-wide`}>
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
  hero?: boolean;
};

/** Für Training/Event-Zeile in derselben Karte (Termine). */
export function MatchCardKickoffBlock({ timeDisplay, showUhr, location, headerLabel, hero }: KickoffBlockProps) {
  const hasLocation = location != null && location.trim() !== '';
  const locationLines = hasLocation
    ? formatLocationLines(location)
    : { line1: '', line2: null as string | null, line3: null as string | null };

  const timeClass = hero
    ? 'mt-2 text-[40px] sm:text-[52px] font-extrabold leading-[1] text-white tabular-nums'
    : 'mt-2 text-[34px] sm:text-[44px] font-extrabold leading-[1] text-white tabular-nums';

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className={`${hero ? 'text-[15px] tracking-[0.38em]' : 'text-[14px] tracking-[0.35em]'} text-red-300 font-semibold`}>
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
}: MatchCardGameCoreProps) {
  const hero = variant === 'home-hero';
  const leftSplit = splitPrefixAndName(leftName ?? '');
  const rightSplit = splitPrefixAndName(rightName ?? '');
  const leftLogoUrl = getLogoSrcForDisplayName(leftName ?? '', null);
  const rightLogoUrl = getLogoSrcForDisplayName(rightName ?? '', opponentLogoUrl ?? null);

  const gridMt = hero ? 'mt-5' : 'mt-4';
  const gridGap = hero ? 'gap-x-5' : 'gap-x-4';
  const meetupMt = hero ? 'mt-6' : 'mt-5';

  return (
    <>
      {headerTitle ? (
        <div className="flex justify-center">
          <p className={hero ? 'text-2xl font-semibold text-white' : 'text-xl font-semibold text-white'}>
            {headerTitle}
          </p>
        </div>
      ) : null}

      <div className={`${gridMt} grid grid-cols-[1fr_auto_1fr] items-center ${gridGap}`}>
        <div className="min-w-0 flex flex-col items-center text-center">
          <TeamBlock
            logoUrl={leftLogoUrl}
            prefix={leftSplit.prefix || undefined}
            name={leftSplit.name || '–'}
            hero={hero}
          />
        </div>

        <div className="min-w-0 flex flex-col items-center text-center">
          <MatchCardKickoffBlock
            timeDisplay={isMatch && showScore ? `${homeScore} : ${awayScore}` : timeDisplay}
            showUhr={!isMatch || !showScore}
            location={kickoffLocation}
            headerLabel="ANPFIFF"
            hero={hero}
          />
        </div>

        <div className="min-w-0 px-2 flex flex-col items-center text-center">
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
