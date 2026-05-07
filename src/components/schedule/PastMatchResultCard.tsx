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

function TeamLogoBlock({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="flex h-14 w-14 max-h-16 max-w-[4rem] shrink-0 items-center justify-center text-2xl leading-none text-white/90 [filter:drop-shadow(0_0_8px_rgba(255,255,255,0.12))] sm:h-16 sm:w-16"
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
      className="h-14 w-14 max-h-16 max-w-[4rem] shrink-0 object-contain [filter:drop-shadow(0_0_10px_rgba(255,255,255,0.14))] sm:h-16 sm:w-16"
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
  const homeName = ev.is_home === true ? our : ev.is_home === false ? oppName : our;
  const awayName = ev.is_home === true ? oppName : ev.is_home === false ? our : oppName;

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

      <div className="relative px-3.5 pb-4 pt-3.5 sm:px-4 sm:pb-5 sm:pt-4">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex shrink-0 flex-col leading-none">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-400">{wdAbbrev}</span>
              <span className="mt-0.5 text-[34px] font-black tabular-nums tracking-tight text-white [text-shadow:0_0_24px_rgba(220,38,38,0.35)] sm:text-[38px]">
                {dayBig}
              </span>
              {monSmall ? (
                <span className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-white/45">
                  {monSmall}
                </span>
              ) : null}
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-red-950/80 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-red-300/95">
            Beendet
          </span>
        </div>

        <div className="mb-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2">
          <div className="flex min-w-0 flex-col items-center gap-2">
            <TeamLogoBlock src={homeLogoSrc} label={homeName} />
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center px-0.5">
            <span
              className="text-center text-[2.25rem] font-black leading-none tracking-tight text-white [text-shadow:0_0_28px_rgba(220,38,38,0.45),0_2px_12px_rgba(0,0,0,0.85)] sm:text-5xl"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {scoreStr}
            </span>
            {halftimeLine ? (
              <span className="mt-1.5 text-sm text-white/50">{halftimeLine}</span>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2">
            <TeamLogoBlock src={awayLogoSrc} label={awayName} />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 px-0.5">
          <p
            className="min-w-0 text-center text-[15px] font-semibold leading-snug text-white line-clamp-2 break-normal hyphens-none [overflow-wrap:normal] [word-break:normal] sm:text-[17px]"
            lang="de"
          >
            {homeName}
          </p>
          <p
            className="min-w-0 text-center text-[15px] font-semibold leading-snug text-white line-clamp-2 break-normal hyphens-none [overflow-wrap:normal] [word-break:normal] sm:text-[17px]"
            lang="de"
          >
            {awayName}
          </p>
        </div>

        <div className="flex items-end justify-between gap-2 border-t border-white/[0.07] pt-3">
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
