import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getClubLogo } from '../../lib/teamLogos';
import { splitCombinedLocation } from '../../lib/eventLocation';
import { formatCompactListWeekdayAbbrev } from './scheduleEventViewUtils';
import { VIENNA_TZ } from '../../lib/viennaTime';

export type PastMatchResultCardProps = {
  ev: EventRow;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  /** Aus `matches.score_home` / `score_away` (Heim : Auswärts), bei gültigen Abschnitten Summe aus period_scores. */
  scoreHome: number | null;
  scoreAway: number | null;
  /** Klammer aus period_scores, z. B. „(2:3 | 2:0 | 3:2)“. */
  periodBracketLine?: string | null;
  /** Optional z. B. „(1:0)“ wenn später Daten verfügbar — sonst ausgeblendet. */
  halftimeLine?: string | null;
  forcePublicView: boolean;
  onNavigate: (id: string) => void;
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
      alt={label}
      className="h-10 w-10 shrink-0 object-contain [filter:drop-shadow(0_0_10px_rgba(255,255,255,0.14))] sm:h-11 sm:w-11"
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        if (img.src.endsWith('/logos/placeholder-shield-a.png')) return;
        img.src = '/logos/placeholder-shield-a.png';
      }}
    />
  );
}

/**
 * Premium Ergebnis-Karte für beendete Spiele (Terminliste „Vergangen“).
 * Nur Darstellung — Navigation & Daten kommen von außen.
 */
export function PastMatchResultCard({
  ev,
  ourTeamName,
  opponentLogoUrl,
  scoreHome,
  scoreAway,
  periodBracketLine,
  halftimeLine,
  forcePublicView,
  onNavigate,
}: PastMatchResultCardProps) {
  const clickable = !forcePublicView;
  const handleActivate = () => {
    if (clickable) onNavigate(ev.id);
  };

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  const our = (ourTeamName ?? '').trim() || 'Unser Team';
  const homeName = compactTeamName(ev.is_home === true ? our : ev.is_home === false ? oppName : our);
  const awayName = compactTeamName(ev.is_home === true ? oppName : ev.is_home === false ? our : oppName);

  const homeLogoSrc =
    ev.is_home === true
      ? getClubLogo(our)
      : ev.is_home === false
        ? getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined })
        : getClubLogo(our);
  const awayLogoSrc =
    ev.is_home === true
      ? getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined })
      : ev.is_home === false
        ? getClubLogo(our)
        : getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });

  const h = scoreHome != null ? scoreHome : null;
  const a = scoreAway != null ? scoreAway : null;
  const scoreStr =
    h !== null && a !== null ? `${h} : ${a}` : h !== null || a !== null ? `${h ?? '–'} : ${a ?? '–'}` : '– : –';

  const wdAbbrev = formatCompactListWeekdayAbbrev(ev.starts_at);
  const d = ev.starts_at ? new Date(ev.starts_at) : null;
  const weekdayBadge =
    d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat('de-AT', { weekday: 'short', timeZone: VIENNA_TZ })
          .format(d)
          .replace('.', '')
          .slice(0, 2)
          .toUpperCase()
      : wdAbbrev.replace('.', '').slice(0, 2).toUpperCase();
  const dayBig =
    d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', timeZone: VIENNA_TZ }).format(d)
      : '–';
  const monSmall =
    d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: VIENNA_TZ }).format(d).replace(/\.$/, '')
      : '';
  const yearSmall = d && !Number.isNaN(d.getTime()) ? d.getFullYear().toString() : '';

  const parsedLoc = splitCombinedLocation(ev.location ?? '');
  const venue = (parsedLoc.place ?? '').trim() || (ev.location ?? '').trim() || null;

  const homeAwayLabel = ev.is_home === true ? 'Heim' : ev.is_home === false ? 'Auswärts' : null;
  const homeSplit = splitPrefixAndName(homeName);
  const awaySplit = splitPrefixAndName(awayName);

  return (
    <div
      className={[
        'group relative mb-4 w-full min-w-0 overflow-hidden rounded-[30px] border border-red-500/20 bg-gradient-to-br from-[#180000] via-black to-[#240000] shadow-[0_10px_40px_rgba(255,0,0,0.18)] outline-none backdrop-blur-sm transition-transform duration-200 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]',
        clickable
          ? 'cursor-pointer hover:border-red-500/35 hover:shadow-[0_12px_44px_rgba(255,0,0,0.26)] active:scale-[0.99]'
          : 'cursor-default',
      ].join(' ')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleActivate : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleActivate();
              }
            }
          : undefined
      }
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,38,38,0.12),transparent_55%)] opacity-90" />

      <div className="relative px-3.5 pb-2.5 pt-3 sm:px-4 sm:pb-3 sm:pt-3.5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex w-[44px] shrink-0 flex-col items-center justify-center gap-0 text-center">
            <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-[#B85C68]">
              {weekdayBadge}
            </span>
            <span className="text-[26px] font-bold tabular-nums leading-none text-white">
              {dayBig}
            </span>
            <span className="text-[11px] font-medium leading-tight text-white/60">
              {monSmall || '—'}
            </span>
            {yearSmall ? <span className="text-[10px] font-medium leading-tight text-white/40">{yearSmall}</span> : null}
          </div>
          <span className="shrink-0 rounded-md border border-red-950/80 bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-red-200/95">
            Beendet
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2">
          <div className="flex min-w-0 max-w-full flex-col items-center justify-start text-center">
            <TeamLogoBlock src={homeLogoSrc} label={homeName} />
            {homeSplit.prefix ? (
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                {homeSplit.prefix}
              </div>
            ) : null}
            <p className="mt-0.5 line-clamp-2 min-w-0 max-w-full text-center text-[14px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal] sm:text-[15px]">
              {homeSplit.name || homeName}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-start px-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-red-300">Endstand</span>
            <span
              className="mt-0.5 text-center text-[2rem] font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[2.2rem]"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {scoreStr}
            </span>
            {periodBracketLine ? (
              <span className="mt-0.5 max-w-[14rem] text-center text-[11px] font-medium tabular-nums leading-snug text-white/55 sm:max-w-none sm:text-[12px]">
                {periodBracketLine}
              </span>
            ) : null}
            {halftimeLine ? (
              <span className="mt-1 text-center text-[12px] text-white/50">{halftimeLine}</span>
            ) : null}
          </div>

          <div className="flex min-w-0 max-w-full flex-col items-center justify-start text-center">
            <TeamLogoBlock src={awayLogoSrc} label={awayName} />
            {awaySplit.prefix ? (
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                {awaySplit.prefix}
              </div>
            ) : null}
            <p className="mt-0.5 line-clamp-2 min-w-0 max-w-full text-center text-[14px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal] sm:text-[15px]">
              {awaySplit.name || awayName}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {homeAwayLabel ? (
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  ev.is_home === true
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
            <ChevronRight
              className="h-5 w-5 shrink-0 text-white/40 transition-colors group-hover:text-red-300/90"
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
