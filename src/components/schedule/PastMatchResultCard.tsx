import React, { useState } from 'react';
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
  /** Aus `matches.score_home` / `score_away` (Heim : Auswärts). */
  scoreHome: number | null;
  scoreAway: number | null;
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
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center text-xl leading-none text-white/90 [filter:drop-shadow(0_0_8px_rgba(255,255,255,0.12))] sm:h-11 sm:w-11"
        aria-hidden
      >
        ⚽
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-10 w-10 shrink-0 object-contain [filter:drop-shadow(0_0_10px_rgba(255,255,255,0.14))] sm:h-11 sm:w-11"
      onError={() => setFailed(true)}
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

      <div className="relative px-3.5 pb-4 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="pointer-events-none flex shrink-0 flex-col items-start gap-0 rounded-lg border border-white/18 bg-black/68 px-1.5 py-1.5 text-left shadow-md backdrop-blur-md sm:px-2 sm:py-1.5">
            <span className="text-[9px] font-black uppercase leading-none tracking-[0.12em] text-red-200 sm:text-[10px]">
              {weekdayBadge}
            </span>
            <span className="text-xl font-black tabular-nums leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-2xl">
              {dayBig}
            </span>
            <span className="text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-white/88 sm:text-[10px]">
              {monSmall || '—'}
            </span>
          </div>
          <span className="shrink-0 rounded-md border border-red-950/80 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-red-200/95">
            Beendet
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-3">
          <div className="flex min-w-0 max-w-full flex-col items-center justify-start text-center">
            <TeamLogoBlock src={homeLogoSrc} label={homeName} />
            {homeSplit.prefix ? (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                {homeSplit.prefix}
              </div>
            ) : (
              <div className="mt-1 h-[14px] sm:h-[16px]" aria-hidden />
            )}
            <p className="mt-0.5 line-clamp-2 min-w-0 max-w-full text-center text-[15px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal] sm:text-[16px]">
              {homeSplit.name || homeName}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-start px-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-red-300">Endstand</span>
            <span
              className="mt-1 text-center text-[2.2rem] font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[2.45rem]"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {scoreStr}
            </span>
            <span className="mt-1 text-[12px] text-white/70">ENDSTAND</span>
            {halftimeLine ? (
              <span className="mt-1.5 text-center text-[12px] text-white/50">{halftimeLine}</span>
            ) : null}
          </div>

          <div className="flex min-w-0 max-w-full flex-col items-center justify-start text-center">
            <TeamLogoBlock src={awayLogoSrc} label={awayName} />
            {awaySplit.prefix ? (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                {awaySplit.prefix}
              </div>
            ) : (
              <div className="mt-1 h-[14px] sm:h-[16px]" aria-hidden />
            )}
            <p className="mt-0.5 line-clamp-2 min-w-0 max-w-full text-center text-[15px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal] sm:text-[16px]">
              {awaySplit.name || awayName}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-white/[0.07] pt-3">
          <div className="min-w-0 flex-1 space-y-2">
            {venue ? (
              <p className="line-clamp-2 text-[12px] leading-snug text-white/55 sm:text-[13px]">{venue}</p>
            ) : (
              <p className="text-[12px] text-white/40">Spielort</p>
            )}
            {homeAwayLabel ? (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  ev.is_home === true
                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'border-amber-500/35 bg-amber-500/12 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.18)]'
                }`}
              >
                {homeAwayLabel}
              </span>
            ) : null}
          </div>
          {clickable ? (
            <ChevronRight
              className="h-6 w-6 shrink-0 text-white/45 transition-colors group-hover:text-red-300/90"
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
