import React from 'react';
import { Dumbbell } from 'lucide-react';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from '../tournament/tournamentCenterUtils';
import { resolveTrainingHeroBackgroundUrl } from '../../lib/trainingCenterVisuals';
import { CenterCompactHero } from '../center/CenterCompactHero';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  coverUrl?: unknown;
};

export function TrainingCompactHero({ title, startsAt, location, coverUrl }: Props) {
  const heroUrl = resolveTrainingHeroBackgroundUrl(
    typeof coverUrl === 'string' ? coverUrl : null,
  );
  const timeLabel = formatTimeHHmmDe(startsAt);
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const placeLine = formatTournamentLocationDisplay(location);
  const metaParts = [
    dateLabel !== '—' ? dateLabel : null,
    timeLabel ? `${timeLabel} Uhr` : null,
    placeLine || null,
  ].filter(Boolean);

  return (
    <CenterCompactHero
      title={title}
      startsAt={startsAt}
      metaLine={metaParts.join(' · ')}
      badgeLabel="Training"
      badgeIcon={
        <Dumbbell
          className="h-2.5 w-2.5 shrink-0 text-red-300 drop-shadow-[0_0_8px_rgba(255,71,71,0.45)]"
          strokeWidth={2.25}
          aria-hidden
        />
      }
      coverUrl={heroUrl}
      imageObjectPosition="50% 38%"
    />
  );
}
