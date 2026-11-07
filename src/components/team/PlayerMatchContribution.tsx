import { Clock } from 'lucide-react';
import type { PlayerLastMatchRow } from '../../lib/stats/playerStatsService';

/** Keep unknown playing time distinct from a confirmed zero-minute appearance. */
export function PlayerMatchContribution({ match }: {
  match: Pick<PlayerLastMatchRow, 'minutes' | 'minutesKnown' | 'badgeKind' | 'badgeLabel' | 'goals'>;
}) {
  const known = match.minutesKnown ?? (match.badgeKind !== 'unknown' || match.badgeLabel.includes('berechnet'));
  const calculated = known && match.badgeKind === 'unknown';
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm font-bold tabular-nums">
      <span className="inline-flex items-center gap-1 text-white/90" title={calculated ? 'Aus ÖFB-Aufstellung, Wechseln und hinterlegter Spieldauer berechnet' : undefined}>
        <Clock size={15} aria-hidden="true" />
        {known ? match.minutes : '—'} Min.
      </span>
      <span className="whitespace-nowrap text-amber-200/95">⚽ {match.goals} {match.goals === 1 ? 'Tor' : 'Tore'}</span>
    </span>
  );
}
