import React, { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { resolveTournamentHeroBackgroundUrl } from '../../lib/matchCenterTournamentVisuals';
import { computeMatchCenterCountdown } from '../../lib/matchCenterUtils';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { safeOptionalText } from '../../lib/safeText';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from './tournamentCenterUtils';
import { MatchCenterCountdown } from '../live/MatchCenterCountdown';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  coverUrl?: unknown;
};

export function TournamentCompactCard({ title, startsAt, location, coverUrl }: Props) {
  const [now, setNow] = useState(() => new Date());
  const heroUrl = resolveTournamentHeroBackgroundUrl(safeOptionalText(coverUrl));
  const timeLabel = formatTimeHHmmDe(startsAt);
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const placeLine = formatTournamentLocationDisplay(location);
  const metaParts = [
    dateLabel !== '—' ? dateLabel : null,
    timeLabel ? `${timeLabel} Uhr` : null,
    placeLine || null,
  ].filter(Boolean);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const countdown = useMemo(() => computeMatchCenterCountdown(startsAt, now), [startsAt, now]);
  const showCountdown = countdown && (countdown.days > 0 || countdown.hours > 0 || countdown.minutes > 0);

  return (
    <article className="relative overflow-hidden rounded-[16px] bg-[#060608] shadow-[0_10px_32px_rgba(0,0,0,0.58)] ring-1 ring-[rgba(255,71,71,0.12)]">
      <div className="relative min-h-[7.5rem] w-full overflow-hidden sm:min-h-[8.5rem]">
        <img
          src={heroUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[84%_42%]"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0)_18%,rgba(0,0,0,0.15)_42%,rgba(6,4,6,0.92)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_38%,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.45)_100%)]"
          aria-hidden
        />

        <div className="relative flex h-full min-h-[inherit] flex-col px-3 pb-2 pt-1.5 sm:px-3.5">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-white/[0.1] bg-black/45 px-1.5 py-px text-[7px] font-semibold uppercase tracking-[0.08em] text-white/82 backdrop-blur-[2px]">
              <Trophy
                className="h-2.5 w-2.5 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                strokeWidth={2.25}
                aria-hidden
              />
              Turnier
            </span>
            {showCountdown && countdown ? (
              <div className="w-[min(46%,9.5rem)] shrink-0 scale-[0.88] origin-top-right sm:scale-90">
                <MatchCenterCountdown
                  parts={countdown}
                  variant="heroCompact"
                  showHeader
                  headerLabel="Countdown"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-auto flex max-w-[88%] flex-col justify-center pt-1">
            <h2 className="line-clamp-2 text-left text-[18px] font-extrabold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)] sm:text-[19px]">
              {title}
            </h2>
            {metaParts.length > 0 ? (
              <p className="mt-1 truncate text-[10px] font-medium leading-snug text-white/86 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)] sm:text-[11px]">
                {metaParts.join(' · ')}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
