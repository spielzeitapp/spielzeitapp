import React from 'react';
import { Trophy } from 'lucide-react';
import { resolveTournamentHeroBackgroundUrl } from '../../lib/matchCenterTournamentVisuals';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { safeOptionalText } from '../../lib/safeText';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from './tournamentCenterUtils';
import { CenterCompactHero } from '../center/CenterCompactHero';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  coverUrl?: unknown;
};

export function TournamentCompactCard({ title, startsAt, location, coverUrl }: Props) {
  const heroUrl = resolveTournamentHeroBackgroundUrl(safeOptionalText(coverUrl));
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const timeLabel = formatTimeHHmmDe(startsAt);
  const placeLine = formatTournamentLocationDisplay(location);
  const metaLine = [
    dateLabel !== '—' ? dateLabel : null,
    timeLabel ? `${timeLabel} Uhr` : null,
    placeLine || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <CenterCompactHero
      title={title}
      startsAt={startsAt}
      metaLine={metaLine}
      badgeLabel="Turnier"
      badgeIcon={
        <Trophy
          className="h-2.5 w-2.5 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
          strokeWidth={2.25}
          aria-hidden
        />
      }
      coverUrl={heroUrl}
    />
  );
}
