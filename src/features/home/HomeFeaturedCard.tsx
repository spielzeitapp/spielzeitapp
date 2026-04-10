import React from 'react';
import { Link } from 'react-router-dom';
import type { EventRow } from '../../hooks/useEvents';
import { MatchdayCard } from '../../components/feed/MatchdayCard';
import { formatDateTimeDeVienna } from '../../lib/notifications/format';
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
    <div
      className="rounded-2xl border border-white/[0.1] p-6 shadow-lg"
      style={{
        background: 'linear-gradient(160deg, #161616 0%, #101010 100%)',
        boxShadow: '0 16px 32px rgba(0,0,0,0.35)',
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-400/90">Nächster Termin</p>
      <p className="mt-3 text-2xl font-bold text-white">{label}</p>
      <p className="mt-2 text-base text-white/80">{when}</p>
      <p className="mt-1 text-base text-white/60">{place}</p>
      <p className="mt-4 text-lg font-semibold text-red-400">{countdown}</p>
      <Link
        to={`/app/events/${event.id}`}
        className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-base font-semibold text-red-400 transition-colors hover:bg-red-500/20"
      >
        Details &amp; Zu-/Absage
      </Link>
    </div>
  );
}

export const HomeFeaturedCard: React.FC<HomeFeaturedCardProps> = ({ featured, teamName, now }) => {
  if (!featured) {
    return (
      <div
        className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 text-center shadow-lg"
        style={{ boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}
      >
        <p className="text-base text-white/65">Keine bevorstehenden Termine.</p>
        <Link
          to="/app/termine"
          className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-red-500 px-5 py-3 text-base font-semibold text-white hover:bg-red-600"
        >
          Zu den Terminen
        </Link>
      </div>
    );
  }

  if (featured.type === 'matchday') {
    return <MatchdayCard event={featured.event} teamName={teamName} />;
  }

  return <NextEventHero event={featured.event} now={now} />;
};
