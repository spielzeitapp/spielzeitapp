import React from 'react';
import { Clock3, MapPin, Trophy, Users } from 'lucide-react';
import { resolveTournamentHeroBackgroundUrl } from '../../lib/matchCenterTournamentVisuals';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import { safeOptionalText } from '../../lib/safeText';
import { formatTournamentDayDate } from './tournamentCenterUtils';
import { CenterCompactHero } from '../center/CenterCompactHero';
import { formatFeedVenueShort } from '../../lib/eventLocation';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  /** Event Source of Truth: `events.meeting_at` */
  meetingAt?: string | null;
  coverUrl?: unknown;
  participantCount?: number | null;
  hideCountdown?: boolean;
  badgeLabel?: string;
  compact?: boolean;
  actions?: React.ReactNode;
  titleActions?: React.ReactNode;
};

export function TournamentCompactCard({
  title,
  startsAt,
  location,
  meetingAt = null,
  coverUrl,
  participantCount = null,
  hideCountdown = false,
  badgeLabel = 'Turnier',
  compact = false,
  actions,
  titleActions,
}: Props) {
  const heroUrl = resolveTournamentHeroBackgroundUrl(safeOptionalText(coverUrl));
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const timeLabel = formatTimeHHmmDe(startsAt);
  const meetupRaw = meetingAt ? formatMeetupTimeOnlyDe(meetingAt) : '';
  const meetupLabel = meetupRaw.replace(/\s*Uhr$/i, '').trim();
  const placeLine = formatFeedVenueShort(safeOptionalText(location));


  if (compact) {
    return (
      <article className="relative overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--hero px-4 py-4">
        <div className="sz-club-diagonal-lines pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative space-y-2">
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 h-7 w-7 shrink-0 text-amber-300/95" strokeWidth={1.8} aria-hidden />
            <h2 className="min-w-0 flex-1 break-words text-[22px] font-extrabold leading-tight text-white">{title}</h2>
            {titleActions ? <div className="shrink-0">{titleActions}</div> : null}
          </div>
          <p className="text-[16px] font-medium text-white/70">{dateLabel}</p>
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-[16px] font-semibold text-white/85">
            <span>Treffpunkt {meetupLabel || 'offen'}</span>
            <span aria-hidden>·</span>
            <span>Beginn {timeLabel || 'offen'}</span>
          </p>
          {actions ? <div className="flex justify-end pt-1">{actions}</div> : null}
        </div>
      </article>
    );
  }

  return (
    <CenterCompactHero
      title={title}
      startsAt={startsAt}
      metaLine={dateLabel}
      metaDetails={
        <dl className="mt-3 grid grid-cols-[1fr_1fr_1.3fr] divide-x divide-white/10 border-t border-white/10 pt-3 pb-1 text-center">
          <div className="min-w-0 px-1">
            <dt className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">
              <Users className="sz-club-accent-text h-5 w-5" strokeWidth={2} aria-hidden />
              Treffpunkt
            </dt>
            <dd className="mt-1 text-[24px] font-extrabold tabular-nums leading-none text-white sm:text-[26px]">{meetupLabel || '–'}</dd>
            {meetupLabel ? <dd className="mt-1 text-[11px] text-white/60">Uhr</dd> : null}
          </div>
          <div className="min-w-0 px-1">
            <dt className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">
              <Clock3 className="sz-club-accent-text h-5 w-5" strokeWidth={2} aria-hidden />
              Beginn
            </dt>
            <dd className="mt-1 text-[24px] font-extrabold tabular-nums leading-none text-white sm:text-[26px]">{timeLabel || '–'}</dd>
            {timeLabel ? <dd className="mt-1 text-[11px] text-white/60">Uhr</dd> : null}
          </div>
          <div className="min-w-0 px-2">
            <dt className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">
              <MapPin className="sz-club-accent-text h-5 w-5" strokeWidth={2} aria-hidden />
              Ort
            </dt>
            <dd className="mt-1 text-[12px] font-bold leading-snug text-white sm:text-[13px]">{placeLine || 'Noch offen'}</dd>
          </div>
        </dl>
      }
      badgeLabel={badgeLabel}
      badgeIcon={
        <Trophy
          className="h-2.5 w-2.5 shrink-0 text-amber-300/95"
          strokeWidth={2.25}
          aria-hidden
        />
      }
      coverUrl={heroUrl}
      imageObjectPosition="50% 36%"
      participantCount={participantCount}
      tall
      clubBackground
      hideCountdown={hideCountdown}
      compactCountdown
    />
  );
}
