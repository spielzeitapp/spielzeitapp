import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { SeasonMatchCardData } from '../../lib/seasonMatchStats';
import { seasonMatchCardHref } from '../../lib/seasonMatchStats';
import { getClubLogo } from '../../lib/teamLogos';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  match: SeasonMatchCardData;
  ourTeamName: string;
  footerSlot?: React.ReactNode;
  variant?: 'standard' | 'appearance';
};

function compactTeamName(name: string | null | undefined): string {
  let s = (name ?? '').trim();
  if (!s) return 'Team';
  s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  s = s.replace(/^U\s*\d{1,2}\s+/i, '').trim();
  s = s.replace(/^U\d{1,2}\s+/i, '').trim();
  return s || (name ?? '').trim() || 'Team';
}

function tokenLooksLikeAbbrev(token: string): boolean {
  const t = (token || '').trim();
  if (t.length < 2 || t.length > 8) return false;
  const plain = t.replace(/\./g, '');
  if (plain.length < 2) return false;
  if (/^[A-Z0-9.]+$/.test(t) && plain.length <= 6) return true;
  return /^[A-ZÄÖÜ]{2,6}$/.test(t);
}

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

function TeamLogoBlock({ src, label }: { src: string; label: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className="h-10 w-10 shrink-0 object-contain [filter:drop-shadow(0_0_10px_rgba(255,255,255,0.14))] sm:h-11 sm:w-11"
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        if (img.src.endsWith('/logos/placeholder-shield-a.png')) return;
        img.src = '/logos/placeholder-shield-a.png';
      }}
    />
  );
}

function statusBadge(match: SeasonMatchCardData): { label: string; className: string } {
  if (match.displayStatus === 'live') {
    return {
      label: 'Live',
      className: 'border-red-500/40 bg-red-500/15 text-red-200',
    };
  }
  if (match.displayStatus === 'win') {
    return {
      label: 'Sieg',
      className: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
    };
  }
  if (match.displayStatus === 'draw') {
    return {
      label: 'Remis',
      className: 'border-amber-500/35 bg-amber-500/12 text-amber-100',
    };
  }
  if (match.displayStatus === 'loss') {
    return {
      label: 'Niederlage',
      className: 'border-red-500/35 bg-red-500/12 text-red-200',
    };
  }
  return {
    label: 'Geplant',
    className: 'border-white/15 bg-white/[0.06] text-white/70',
  };
}

function headerBadge(match: SeasonMatchCardData): string {
  if (match.displayStatus === 'live') return 'Live';
  return 'Geplant';
}

export const SeasonMatchCard: React.FC<Props> = ({ match, ourTeamName, footerSlot, variant = 'standard' }) => {
  const appearance = variant === 'appearance';
  const navigate = useNavigate();
  const basePath = useInternalBasePath();
  const href = seasonMatchCardHref(match.eventId, basePath, match.id);
  const clickable = Boolean(href);

  const handleClick = () => {
    if (href) navigate(href);
  };

  const oppName = (match.opponent ?? 'Gegner').trim() || 'Gegner';
  const our = (ourTeamName ?? '').trim() || 'Unser Team';
  const homeName = compactTeamName(match.isHome === true ? our : match.isHome === false ? oppName : our);
  const awayName = compactTeamName(match.isHome === true ? oppName : match.isHome === false ? our : oppName);

  const homeLogoSrc =
    match.isHome === true
      ? getClubLogo(our)
      : match.isHome === false
        ? getClubLogo(oppName)
        : getClubLogo(our);
  const awayLogoSrc =
    match.isHome === true
      ? getClubLogo(oppName)
      : match.isHome === false
        ? getClubLogo(our)
        : getClubLogo(oppName);

  const h = match.score_home ?? match.teamGoals;
  const a = match.score_away ?? match.oppGoals;
  const scoreStr =
    match.displayStatus === 'live'
      ? 'Live'
      : h != null && a != null
        ? `${h}:${a}`
        : '– : –';

  const iso = match.match_date;
  const d = iso ? new Date(iso) : null;
  const weekdayBadge =
    d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat('de-AT', { weekday: 'short', timeZone: VIENNA_TZ })
          .format(d)
          .replace('.', '')
          .slice(0, 2)
          .toUpperCase()
      : '–';
  const dayBig =
    d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', timeZone: VIENNA_TZ }).format(d)
      : '–';
  const monSmall =
    d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: VIENNA_TZ }).format(d).replace(/\.$/, '')
      : '';
  const yearSmall = d && !Number.isNaN(d.getTime()) ? d.getFullYear().toString() : '';

  const venue = formatFeedVenueShort(match.location);
  const homeAwayLabel = match.isHome === true ? 'Heim' : match.isHome === false ? 'Auswärts' : null;
  const homeSplit = splitPrefixAndName(homeName);
  const awaySplit = splitPrefixAndName(awayName);
  const resultBadge = statusBadge(match);

  return (
    <div
      className={[
        `sz-club-surface sz-club-surface--hero group relative w-full min-w-0 overflow-hidden border outline-none backdrop-blur-sm transition-transform duration-200 ${appearance ? 'rounded-[22px]' : 'rounded-[30px]'}`,
        clickable
          ? 'sz-club-focus cursor-pointer active:scale-[0.99]'
          : 'cursor-default',
      ].join(' ')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className="sz-club-page-hero-glow pointer-events-none absolute inset-0 opacity-90" />

      <div className={`relative px-3.5 sm:px-4 ${appearance ? 'pb-3 pt-3' : 'pb-2.5 pt-3 sm:pb-3 sm:pt-3.5'}`}>
        <div className={`flex justify-between gap-2 ${appearance ? 'mb-2 items-center' : 'mb-1 items-start'}`}>
          <div className={`flex shrink-0 items-center justify-center ${appearance ? 'gap-1.5' : 'w-[44px] flex-col gap-0 text-center'}`}>
            <span className="sz-club-icon text-[11px] font-semibold uppercase leading-none tracking-[0.12em]">
              {weekdayBadge}
            </span>
            <span className={`${appearance ? 'text-[15px]' : 'text-[26px]'} font-bold tabular-nums leading-none text-white`}>{dayBig}</span>
            <span className="text-[11px] font-medium leading-tight text-white/60">{monSmall || '—'}</span>
            {yearSmall ? (
              <span className={`${appearance ? 'text-[11px]' : 'text-[10px]'} font-medium leading-tight text-white/40`}>{yearSmall}</span>
            ) : null}
          </div>
          {appearance && homeAwayLabel ? <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-300/80">{homeAwayLabel}</span> : null}
          {match.outcome == null ? (
            <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] ${
              match.displayStatus === 'live'
                ? 'border-red-500/40 bg-red-500/15 text-red-200'
                : 'sz-club-selected-soft'
            }`}>
              {headerBadge(match)}
            </span>
          ) : null}
        </div>

        <div className={`grid grid-cols-[1fr_auto_1fr] items-start gap-x-2 ${appearance ? 'border-t border-white/[0.07] pt-3' : ''}`}>
          <div className="flex min-w-0 max-w-full flex-col items-center justify-start text-center">
            <TeamLogoBlock src={homeLogoSrc} label={homeName} />
            {homeSplit.prefix ? (
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                {homeSplit.prefix}
              </div>
            ) : null}
            <p className={`mt-0.5 line-clamp-2 min-w-0 max-w-full text-center font-semibold leading-tight text-white ${appearance ? 'text-[13px] sm:text-[14px]' : 'text-[14px] sm:text-[15px]'}`}>
              {homeSplit.name || homeName}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-start px-0.5">
            <span className={`text-[12px] font-bold uppercase tracking-[0.16em] ${
              match.displayStatus === 'live' ? 'text-red-300' : 'sz-club-icon'
            }`}>
              {match.outcome != null ? 'Endstand' : match.displayStatus === 'live' ? 'Live' : 'Anpfiff'}
            </span>
            <span className="mt-1 text-center text-[2.3rem] font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[2.5rem]">
              {scoreStr}
            </span>
            <span
              className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${resultBadge.className}`}
            >
              {resultBadge.label}
            </span>
          </div>

          <div className="flex min-w-0 max-w-full flex-col items-center justify-start text-center">
            <TeamLogoBlock src={awayLogoSrc} label={awayName} />
            {awaySplit.prefix ? (
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                {awaySplit.prefix}
              </div>
            ) : null}
            <p className={`mt-0.5 line-clamp-2 min-w-0 max-w-full text-center font-semibold leading-tight text-white ${appearance ? 'text-[13px] sm:text-[14px]' : 'text-[14px] sm:text-[15px]'}`}>
              {awaySplit.name || awayName}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {homeAwayLabel && !appearance ? (
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  match.isHome === true
                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                    : 'border-amber-500/35 bg-amber-500/12 text-amber-100'
                }`}
              >
                {homeAwayLabel}
              </span>
            ) : null}
            {venue ? (
              <p className="line-clamp-1 min-w-0 text-[12px] leading-snug text-white/50">{venue}</p>
            ) : null}
          </div>
          {clickable ? (
            <div className="flex shrink-0 items-center gap-1 text-white/45">
              <span className="text-[11px] font-semibold">{appearance ? 'Zum Spiel' : 'Details'}</span>
              <ChevronRight
                className="sz-club-icon h-5 w-5 transition-colors"
                strokeWidth={2}
                aria-hidden
              />
            </div>
          ) : null}
        </div>
        {footerSlot ? (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2">
            {footerSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
};
