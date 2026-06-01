import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, MapPin } from 'lucide-react';
import type { HomeMatchCardPick } from './homeFeedBuilder';
import { HOME_FEED_HERO_STATUS_LABEL, HOME_NEXT_MATCH_ORG_LABEL } from './homeFeedBuilder';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { getMatchTypeLabel } from '../../components/match/matchCardLabels';
import { buildFeedMatchMetaLine, parseClubDisplayName } from '../../lib/feedClubNaming';
import { FeedClubName } from '../../components/feed/FeedClubName';
import { FeedMatchMetaLine } from '../../components/feed/feedTypography';

type Props = {
  pick: HomeMatchCardPick;
  teamName?: string;
};

export const HomeUpcomingMatchCompact: React.FC<Props> = ({ pick, teamName }) => {
  const { event, status } = pick;
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourFullName = (teamName ?? getOurTeamDisplayName()).trim() || getOurTeamDisplayName();
  const ourParts = parseClubDisplayName(ourFullName);
  const matchLabel = getMatchTypeLabel(event.match_type ?? event.type);

  const titleLine = useMemo(() => {
    if (status === 'today') return HOME_FEED_HERO_STATUS_LABEL.today;
    if (status === 'tomorrow') return HOME_NEXT_MATCH_ORG_LABEL.tomorrow;
    return HOME_NEXT_MATCH_ORG_LABEL.next;
  }, [status]);

  const matchMetaLine = buildFeedMatchMetaLine(ourParts.ageGroup, matchLabel);

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
    .trim();

  return (
    <section
      className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(22,22,24,0.98)] to-[rgba(12,8,10,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_28px_rgba(0,0,0,0.45)]"
      aria-label="Nächstes Spiel"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-red-600/12 blur-2xl" />
      <Link
        to={`/app/events/${event.id}`}
        className="relative flex min-h-[80px] items-stretch gap-3 px-3 py-3.5 pr-2 transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-red-500/35 bg-red-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-200/95">
              {titleLine}
            </span>
          </div>
          <FeedMatchMetaLine line={matchMetaLine} className="text-left" />
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
            <FeedClubName fullName={ourFullName} variant="compact" align="start" className="min-w-0" />
            <span className="shrink-0 px-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
              vs
            </span>
            <FeedClubName fullName={opponent} variant="compact" align="start" className="min-w-0" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/62">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
              {timeStr}
            </span>
            {placeShort ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
                <span className="min-w-0 break-words">{placeShort}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center self-center pr-1 text-white/32">
          <ChevronRight className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </div>
      </Link>
    </section>
  );
};
