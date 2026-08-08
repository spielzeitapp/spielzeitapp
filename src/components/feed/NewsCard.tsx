import React from 'react';
import { Link } from 'react-router-dom';
import type { HomeMessage } from '../../features/home/homeFeedBuilder';
import { formatRelativeTimeDe } from '../../features/home/homeFeedBuilder';
import { FeedCard } from './FeedCard';
import { useInternalBasePath } from '../../demo/demoPaths';

function previewText(m: HomeMessage): string {
  const raw = (m.body ?? m.content ?? '').replace(/\s+/g, ' ').trim();
  if (raw) return raw.length > 140 ? `${raw.slice(0, 137)}…` : raw;
  return (m.title ?? '').trim() || '—';
}

type NewsCardProps = {
  message: HomeMessage;
  trainerLabel?: string;
  now: Date;
};

export const NewsCard: React.FC<NewsCardProps> = ({ message, trainerLabel = 'Trainer', now }) => {
  const base = useInternalBasePath();
  const rel = formatRelativeTimeDe(message.created_at, now);
  return (
    <FeedCard>
      <h3 className="text-lg font-bold text-white">Letzte Nachricht</h3>
      <Link
        to={base === '/demo' ? `${base}/mehr` : `${base}/nachrichten`}
        className="mt-4 block min-h-[44px] rounded-xl outline-none ring-offset-2 ring-offset-[#0b0b0b] focus-visible:ring-2 focus-visible:ring-red-500/60"
      >
        <p className="text-sm font-semibold text-red-400">{trainerLabel}</p>
        <p className="mt-1 line-clamp-2 text-base font-medium text-white">{message.title}</p>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/65">{previewText(message)}</p>
        <p className="mt-2 text-xs text-white/40">{rel}</p>
      </Link>
    </FeedCard>
  );
};
