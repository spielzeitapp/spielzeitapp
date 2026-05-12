import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, MapPin } from 'lucide-react';
import type { HomeMatchCardPick } from './homeFeedBuilder';
import { HOME_FEED_HERO_STATUS_LABEL, HOME_NEXT_MATCH_ORG_LABEL } from './homeFeedBuilder';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { getMatchTypeLabel } from '../../components/match/matchCardLabels';

type Props = {
  pick: HomeMatchCardPick;
  /** Reserviert für spätere Badges / Team-Kontext */
  teamName?: string;
};

export const HomeUpcomingMatchCompact: React.FC<Props> = ({ pick }) => {
  const { event, status } = pick;
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourClub = getOurTeamDisplayName();

  const titleLine = useMemo(() => {
    if (status === 'today') return HOME_FEED_HERO_STATUS_LABEL.today;
    if (status === 'tomorrow') return HOME_NEXT_MATCH_ORG_LABEL.tomorrow;
    return HOME_NEXT_MATCH_ORG_LABEL.next;
  }, [status]);

  const date = event.starts_at ? new Date(event.starts_at) : null;
  const timeStr = date
    ? new Intl.DateTimeFormat('de-AT', {
        timeZone: VIENNA_TZ,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : '–';

  const parsedLocation = splitCombinedLocation(event.location);
  const placeShort = (formatFullLocation(parsedLocation.place, parsedLocation.address || (event.address ?? '').trim()) || '')
    .trim()
    .slice(0, 48);

  const matchLabel = getMatchTypeLabel(event.match_type ?? event.type);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-[#101010] shadow-lg"
      style={{
        boxShadow: '0 0 0 1px rgba(220,38,38,0.08), 0 10px 28px rgba(0,0,0,0.45)',
      }}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-red-600/15 blur-2xl" />
      <Link
        to={`/app/events/${event.id}`}
        className="relative flex min-h-[72px] items-stretch gap-3 px-3 py-3 pr-2 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-red-500/35 bg-red-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-200/95">
              {titleLine}
            </span>
            {matchLabel ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">{matchLabel}</span>
            ) : null}
          </div>
          <p className="truncate text-sm font-semibold text-white">
            {ourClub} <span className="text-white/35">vs</span> {opponent}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
              {timeStr}
            </span>
            {placeShort ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
                <span className="truncate">{placeShort}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center self-center pr-1 text-white/35">
          <ChevronRight className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </div>
      </Link>
    </section>
  );
};
