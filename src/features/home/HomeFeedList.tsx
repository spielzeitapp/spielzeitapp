import React from 'react';
import { Link } from 'react-router-dom';
import type { EventRow } from '../../hooks/useEvents';
import type { HomeFeedItem } from './homeFeedBuilder';
import { eventKindLabel, formatCountdownToStartsAt } from './homeFeedBuilder';
import { formatDateTimeDeVienna } from '../../lib/notifications/format';
import { FeedCard } from '../../components/feed/FeedCard';
import { ReminderCard } from '../../components/feed/ReminderCard';
import { NewsCard } from '../../components/feed/NewsCard';
import { useInternalBasePath } from '../../demo/demoPaths';

function NextEventListCard({ event, now }: { event: EventRow; now: Date }) {
  const base = useInternalBasePath();
  const label = eventKindLabel(event.kind);
  const when = formatDateTimeDeVienna(event.starts_at);
  const place = (event.location ?? event.address ?? '').trim() || '—';
  const countdown = formatCountdownToStartsAt(event.starts_at, now);

  return (
    <FeedCard>
      <h3 className="text-lg font-bold text-white">Nächster Termin</h3>
      <p className="mt-2 text-base font-semibold text-white/90">{label}</p>
      <p className="mt-1 text-sm text-white/70">{when}</p>
      <p className="mt-1 text-sm text-white/55">{place}</p>
      <p className="mt-3 text-base font-semibold text-red-400">{countdown}</p>
      <Link
        to={`${base}/events/${event.id}`}
        className="mt-4 inline-flex min-h-[44px] items-center text-base font-semibold text-red-400 hover:text-red-300"
      >
        Details →
      </Link>
    </FeedCard>
  );
}

type HomeFeedListProps = {
  items: HomeFeedItem[];
  now: Date;
};

export const HomeFeedList: React.FC<HomeFeedListProps> = ({ items, now }) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => {
        const key = `${item.type}-${item.type === 'news' ? item.message.id : item.event.id}-${i}`;
        if (item.type === 'next_event') {
          return <NextEventListCard key={key} event={item.event} now={now} />;
        }
        if (item.type === 'reminder') {
          return (
            <ReminderCard
              key={key}
              event={item.event}
              unansweredChildren={item.unansweredChildren}
            />
          );
        }
        return (
          <NewsCard
            key={key}
            message={item.message}
            trainerLabel={item.trainerLabel}
            now={now}
          />
        );
      })}
    </div>
  );
};
