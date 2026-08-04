import React from 'react';
import { Trophy } from 'lucide-react';
import { resolveTournamentHeroBackgroundUrl } from '../../lib/matchCenterTournamentVisuals';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import { safeOptionalText } from '../../lib/safeText';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from './tournamentCenterUtils';
import { CenterCompactHero } from '../center/CenterCompactHero';

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
  const placeLine = formatTournamentLocationDisplay(location);
  const metaLines = [
    dateLabel !== '—' ? dateLabel : null,
    `Treffpunkt ${meetupLabel || '–'}${meetupLabel ? ' Uhr' : ''}`,
    timeLabel ? `Beginn ${timeLabel} Uhr` : null,
    placeLine || null,
  ].filter(Boolean) as string[];

  return (
    <CenterCompactHero
      title={title}
      startsAt={startsAt}
      metaLine={metaLines.join('\n')}
      metaMultiline
      badgeLabel="Turnier"
      badgeIcon={
        <Trophy
          className="h-2.5 w-2.5 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
          strokeWidth={2.25}
          aria-hidden
        />
      }
      coverUrl={heroUrl}
      imageObjectPosition="50% 36%"
      participantCount={participantCount}
      tall
      vividImage
    />
  );
}
