import React from 'react';
import { Trophy } from 'lucide-react';
import { resolveTournamentHeroBackgroundUrl } from '../../lib/matchCenterTournamentVisuals';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { safeOptionalText } from '../../lib/safeText';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from './tournamentCenterUtils';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  coverUrl?: unknown;
};

export function TournamentCompactCard({ title, startsAt, location, coverUrl }: Props) {
  const heroUrl = resolveTournamentHeroBackgroundUrl(safeOptionalText(coverUrl));
  const timeLabel = formatTimeHHmmDe(startsAt);
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const placeLine = formatTournamentLocationDisplay(location);
  const metaParts = [
    dateLabel !== '—' ? dateLabel : null,
    timeLabel ? `${timeLabel} Uhr` : null,
    placeLine || null,
  ].filter(Boolean);

  return (
    <article className="relative overflow-hidden rounded-[18px] bg-[#060608] shadow-[0_12px_40px_rgba(0,0,0,0.62)] ring-1 ring-[rgba(255,71,71,0.12)]">
      <div className="relative min-h-[8.75rem] w-full overflow-hidden sm:min-h-[10rem]">
        <img
          src={heroUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[84%_48%]"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0)_22%,rgba(0,0,0,0.08)_48%,rgba(6,4,6,0.88)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[68%] bg-[linear-gradient(to_right,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.22)_58%,transparent_100%)]"
          aria-hidden
        />

        <div className="relative flex h-full min-h-[inherit] flex-col px-3 pb-2.5 pt-2 sm:px-3.5">
          <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-white/[0.1] bg-black/40 px-1.5 py-px text-[7px] font-semibold uppercase tracking-[0.08em] text-white/82 backdrop-blur-[2px]">
            <Trophy
              className="h-2.5 w-2.5 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
              strokeWidth={2.25}
              aria-hidden
            />
            Turnier
          </span>

          <div className="mt-auto max-w-[92%] pt-2">
            <h2 className="line-clamp-2 text-left text-[17px] font-bold leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] sm:text-[18px]">
              {title}
            </h2>
            {metaParts.length > 0 ? (
              <p className="mt-1.5 truncate text-[10px] font-medium leading-snug text-white/88 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)] sm:text-[11px]">
                {metaParts.join(' · ')}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
