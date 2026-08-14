import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import type { ScheduleActiveLiveMatch } from '../../lib/scheduleActiveLiveMatch';
import { getTeamInitials, hasKnownClubLogo } from '../../lib/teamLogos';
import { safeText } from '../../lib/safeText';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';

type Props = {
  live: ScheduleActiveLiveMatch;
  liveHref: string;
};

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const known = hasKnownClubLogo(name, { logoUrl });

  if (!known || failed || !logoUrl) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[11px] font-bold text-white/75">
        {getTeamInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      className="h-11 w-11 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
      onError={() => setFailed(true)}
    />
  );
}

/** Kompakte Live-Karte für Termine — read-only CTA zum aktiven matchId. */
export function ScheduleActiveLiveCard({ live, liveHref }: Props) {
  const scoreLine = `${live.scoreHome} : ${live.scoreAway}`;
  const metaBits = [live.kickoffLabel, live.venueLabel].filter(Boolean);

  return (
    <article
      className="mb-3 overflow-hidden rounded-[18px] border border-[rgba(255,71,71,0.35)] bg-[#09070a] shadow-[0_0_28px_rgba(255,71,71,0.14),0_12px_32px_rgba(0,0,0,0.45)]"
      aria-label={`Live ${live.kindLabel}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[rgba(255,71,71,0.2)] bg-[rgba(255,71,71,0.08)] px-3 py-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-red-200">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          LIVE · {safeText(live.kindLabel) || 'SPIEL'}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-950/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-100">
          <Radio className="h-3 w-3 animate-pulse" strokeWidth={2.5} aria-hidden />
          Live
        </span>
      </div>

      <div className="px-3 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <TeamLogo name={live.homeTeamName} logoUrl={live.homeLogoUrl} />
            <p className="max-w-[6.5rem] truncate text-center text-[12px] font-semibold text-white/90">
              {live.homeTeamName}
            </p>
          </div>

          <p className="shrink-0 px-1 text-[26px] font-bold tabular-nums leading-none tracking-tight text-white">
            {scoreLine}
          </p>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <TeamLogo name={live.awayTeamName} logoUrl={live.awayLogoUrl} />
            <p className="max-w-[6.5rem] truncate text-center text-[12px] font-semibold text-white/90">
              {live.awayTeamName}
            </p>
          </div>
        </div>

        {metaBits.length > 0 ? (
          <p className="mt-2.5 text-center text-[11px] text-white/50">{metaBits.join(' · ')}</p>
        ) : null}

        <Link
          to={liveHref}
          className={`${dsPrimaryCtaClass()} mt-3 inline-flex min-h-[46px] w-full touch-manipulation items-center justify-center px-4 py-2.5 text-[14px] font-semibold`}
        >
          Zum Live-Spiel
        </Link>
      </div>
    </article>
  );
}
