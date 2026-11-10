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
};

export function TournamentCompactCard({
  title,
  startsAt,
  location,
  meetingAt = null,
  coverUrl,
  participantCount = null,
}: Props) {
  const heroUrl = resolveTournamentHeroBackgroundUrl(safeOptionalText(coverUrl));
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const timeLabel = formatTimeHHmmDe(startsAt);
  const meetupRaw = meetingAt ? formatMeetupTimeOnlyDe(meetingAt) : '';
  const meetupLabel = meetupRaw.replace(/\s*Uhr$/i, '').trim();
  const placeLine = formatFeedVenueShort(safeOptionalText(location));


  return (
    <CenterCompactHero
      title={title}
      startsAt={startsAt}
      metaLine={dateLabel}
      metaDetails={
        <dl className="mt-3 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-3 pb-1 text-center">
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
            <dd className="mt-1 break-words text-[12px] font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-[13px]">{placeLine || 'Noch offen'}</dd>
          </div>
        </dl>
      }
      badgeLabel="Turnier"
      badgeIcon={
        <Trophy
          className="sz-club-accent-text h-2.5 w-2.5 shrink-0"
          strokeWidth={2.25}
          aria-hidden
        />
      }
      coverUrl={heroUrl}
      imageObjectPosition="50% 36%"
      participantCount={participantCount}
      tall
      clubBackground
      compactCountdown
    />
  );
}
