import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Users } from 'lucide-react';
import { computeMatchCenterCountdown } from '../../lib/matchCenterUtils';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { MatchCenterCountdown } from '../live/MatchCenterCountdown';
import { EC_HERO_HEIGHT, EC_HERO_HEIGHT_TALL, EC_HERO_SHELL } from './eventCenterStyles';

type Props = {
  title: string;
  startsAt: string;
  metaLine: string;
  /** Mehrzeilige Meta (z. B. Datum / Treffpunkt / Beginn / Ort). */
  metaMultiline?: boolean;
  metaDetails?: React.ReactNode;
  badgeLabel: string;
  badgeIcon: React.ReactNode;
  coverUrl: string;
  imageObjectPosition?: string;
  participantCount?: number | null;
  tall?: boolean;
  vividImage?: boolean;
  compactCountdown?: boolean;
  hideCountdown?: boolean;
  clubBackground?: boolean;
};

export function CenterCompactHero({
  title,
  startsAt,
  metaLine,
  metaMultiline = false,
  metaDetails,
  badgeLabel,
  badgeIcon,
  coverUrl,
  imageObjectPosition = '84% 42%',
  participantCount = null,
  tall = false,
  vividImage = false,
  compactCountdown = false,
  hideCountdown = false,
  clubBackground = false,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const countdown = useMemo(() => computeMatchCenterCountdown(startsAt, now), [startsAt, now]);
  const showCountdown = countdown && (countdown.days > 0 || countdown.hours > 0 || countdown.minutes > 0);
  const timeLabel = formatTimeHHmmDe(startsAt);
  const heightClass = tall ? EC_HERO_HEIGHT_TALL : EC_HERO_HEIGHT;

  return (
    <article className={clubBackground ? "relative overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--hero" : EC_HERO_SHELL}>
      <div className={`relative ${heightClass} w-full overflow-hidden`}>
        {clubBackground ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="sz-club-diagonal-lines absolute inset-0" />
            <Trophy className="absolute right-4 top-1/2 h-24 w-24 -translate-y-1/2 text-[rgb(var(--club-accent-rgb)/0.12)] sm:h-28 sm:w-28" strokeWidth={1} />
          </div>
        ) : (
          <>
        <img
          src={coverUrl}
          alt=""
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${vividImage ? 'brightness-[1.08] saturate-[1.12]' : ''}`}
          style={{ objectPosition: imageObjectPosition }}
        />
        <div
          className={
            vividImage
              ? 'pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0)_22%,rgba(0,0,0,0.12)_48%,rgba(6,4,6,0.88)_100%)]'
              : 'pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0)_18%,rgba(0,0,0,0.15)_42%,rgba(6,4,6,0.92)_100%)]'
          }
          aria-hidden
        />
        <div
          className={
            vividImage
              ? 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_38%,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.32)_100%)]'
              : 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_38%,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.45)_100%)]'
          }
          aria-hidden
        />

          </>
        )}
        <div className="relative flex h-full min-h-[inherit] flex-col px-3 pb-2.5 pt-1.5 sm:px-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-white/[0.1] bg-black/45 px-1.5 py-px text-[7px] font-semibold uppercase tracking-[0.08em] text-white/82 backdrop-blur-[2px]">
                {badgeIcon}
                {badgeLabel}
              </span>
              {participantCount != null && participantCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-black/40 px-1.5 py-px text-[7px] font-semibold text-white/72 backdrop-blur-[2px]">
                  <Users className="h-2 w-2 shrink-0 sz-club-accent-text" strokeWidth={2.5} aria-hidden />
                  {participantCount} Teams
                </span>
              ) : null}
            </div>
            {!hideCountdown && showCountdown && countdown ? (
              compactCountdown ? (
                <span className="sz-club-accent-chip shrink-0 rounded-full border bg-black/60 px-2.5 py-1 text-[11px] font-semibold">
                  {countdown.days > 0 ? `In ${countdown.days} ${countdown.days === 1 ? 'Tag' : 'Tagen'}` : countdown.hours > 0 ? `In ${countdown.hours} Std. ${countdown.minutes} Min.` : `In ${countdown.minutes} Min.`}
                </span>
              ) : <div className="w-[min(46%,9.5rem)] shrink-0 scale-[0.9] origin-top-right sm:scale-95">
                <MatchCenterCountdown
                  parts={countdown}
                  variant="heroCompact"
                  showHeader
                  headerLabel="Countdown"
                />
              </div>
            ) : null}
          </div>

          <div className={`mt-auto flex flex-col justify-center pt-3 ${clubBackground ? 'max-w-[85%]' : 'max-w-[92%]'}`}>
            <h2
              className={`line-clamp-2 text-left font-extrabold leading-[1.06] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)] ${
                tall ? 'text-[20px] sm:text-[22px]' : 'text-[18px] sm:text-[19px]'
              }`}
            >
              {title}
            </h2>
            <p
              className={
                metaDetails
                  ? 'mt-2 text-[12px] font-medium leading-snug text-white/70'
                  : metaMultiline
                  ? 'mt-0.5 whitespace-pre-line text-[9px] font-medium leading-snug text-white/78 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)] sm:text-[10px]'
                  : 'mt-0.5 truncate text-[9px] font-medium leading-snug text-white/78 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)] sm:text-[10px]'
              }
            >
              {metaLine || (timeLabel ? `${timeLabel} Uhr` : '—')}
            </p>
          </div>
          {metaDetails}
        </div>
      </div>
    </article>
  );
}
