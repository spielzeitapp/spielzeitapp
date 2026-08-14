import React from 'react';
import { Link } from 'react-router-dom';
import type { EventRow } from '../../hooks/useEvents';
import { formatEventTimeVienna } from '../../lib/notifications/format';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { useInternalBasePath } from '../../demo/demoPaths';
import { FeedCard } from './FeedCard';

function phraseForEvent(ev: EventRow): string {
  if (ev.kind === 'training') return 'das Training';
  if (ev.kind === 'event') return 'den Termin';
  return 'das Spiel';
}

function whenLine(iso: string | null): string {
  if (!iso) return 'bald';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'bald';
    const weekday = new Intl.DateTimeFormat('de-DE', { timeZone: VIENNA_TZ, weekday: 'long' }).format(d);
    const time = formatEventTimeVienna(iso);
    return `${weekday} um ${time}`;
  } catch {
    return 'bald';
  }
}

type ReminderCardProps = {
  event: EventRow;
  unansweredChildren: number;
};

export const ReminderCard: React.FC<ReminderCardProps> = ({ event, unansweredChildren }) => {
  const basePath = useInternalBasePath();
  const n = Math.max(1, unansweredChildren);
  return (
    <FeedCard className="border-amber-500/20 bg-[#1a1510]">
      <h3 className="text-lg font-bold text-white">Offene Aktionen</h3>
      <p className="mt-3 text-base leading-relaxed text-white/85">
        Bitte sag für {phraseForEvent(event)} am {whenLine(event.starts_at)} zu.
      </p>
      <p className="mt-2 text-sm text-amber-200/95">
        Noch {n} Rückmeldung{n === 1 ? '' : 'en'} offen
      </p>
      <Link
        to={`${basePath}/events/${event.id}`}
        className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 text-base font-semibold text-red-400 transition-colors hover:bg-red-500/25"
      >
        Jetzt reagieren
      </Link>
    </FeedCard>
  );
};
