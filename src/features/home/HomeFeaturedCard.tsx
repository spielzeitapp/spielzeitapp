import React from 'react';
import { Link } from 'react-router-dom';
import type { EventRow } from '../../hooks/useEvents';
import { MatchdayCard } from '../../components/feed/MatchdayCard';
import { formatDateTimeDeVienna } from '../../lib/notifications/format';
import { dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { PremiumCard, PremiumEmptyState } from '../../ui';
import { cn } from '../../ui/lib/cn';
import { formatCountdownToStartsAt, eventKindLabel } from './homeFeedBuilder';

type HomeFeaturedCardProps = {
  featured:
    | { type: 'matchday'; event: EventRow }
    | { type: 'next_event'; event: EventRow }
    | null;
  teamName: string;
  now: Date;
};

function NextEventHero({ event, now }: { event: EventRow; now: Date }) {
  const label = eventKindLabel(event.kind);
  const when = formatDateTimeDeVienna(event.starts_at);
  const place = (event.location ?? event.address ?? '').trim() || '—';
  const countdown = formatCountdownToStartsAt(event.starts_at, now);

  return (
    <PremiumCard className="p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-400/90">Nächster Termin</p>
      <p className="mt-3 text-2xl font-bold text-white">{label}</p>
      <p className="mt-2 text-base text-white/80">{when}</p>
      <p className="mt-1 text-base text-white/60">{place}</p>
      <p className="mt-4 text-lg font-semibold text-red-400">{countdown}</p>
      <Link
        to={`/app/events/${event.id}`}
        className={cn(
          dsSecondaryCtaClass(),
          'mt-5 flex min-h-[48px] w-full items-center justify-center border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20',
        )}
      >
        Details &amp; Zu-/Absage
      </Link>
    </PremiumCard>
  );
}

export const HomeFeaturedCard: React.FC<HomeFeaturedCardProps> = ({ featured, teamName, now }) => {
  if (!featured) {
    return (
      <PremiumEmptyState title="Keine bevorstehenden Termine.">
        <Link
          to="/app/termine"
          className={cn(dsSecondaryCtaClass(), 'inline-flex min-h-[48px] items-center justify-center px-5 py-3')}
        >
          Zu den Terminen
        </Link>
      </PremiumEmptyState>
    );
  }

  if (featured.type === 'matchday') {
    return <MatchdayCard event={featured.event} teamName={teamName} />;
  }

  return <NextEventHero event={featured.event} now={now} />;
};
