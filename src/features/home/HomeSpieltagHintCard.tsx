import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import type { HomeMatchCardPick } from './homeFeedBuilder';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe } from '../../components/match/matchCardLabels';
import { MatchdayPosterCard } from '../../components/feed/MatchdayPosterCard';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';

type Props = {
  pick: HomeMatchCardPick;
  reviewPending?: boolean;
};

export const HomeSpieltagHintCard: React.FC<Props> = ({ pick, reviewPending = false }) => {
  const { event, status } = pick;
  const [shareHint, setShareHint] = useState<string | null>(null);
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourClub = getOurTeamDisplayName();
  const isHome = event.is_home !== false;
  const homeName = isHome ? ourClub : opponent;
  const awayName = isHome ? opponent : ourClub;
  const homeLogo = isHome
    ? getClubLogo(ourClub)
    : getClubLogo(homeName, { logoUrl: event.opponent_logo_url ?? undefined });
  const awayLogo = isHome
    ? getClubLogo(awayName, { logoUrl: event.opponent_logo_url ?? undefined })
    : getClubLogo(ourClub);

  const kickoff =
    event.starts_at && !Number.isNaN(new Date(event.starts_at).getTime())
      ? formatMeetupTimeOnlyDe(event.starts_at)
      : '—';
  const meetingTime =
    event.meeting_at && !Number.isNaN(new Date(event.meeting_at).getTime())
      ? formatMeetupTimeOnlyDe(event.meeting_at)
      : null;
  const parsed = splitCombinedLocation(event.location);
  const locationLine =
    (formatFullLocation(parsed.place, parsed.address || (event.address ?? '').trim()) || '').trim() || '—';
  const venueLabel = isHome ? 'Heimspiel' : 'Auswärtsspiel';

  const eventUrl =
    typeof window !== 'undefined'
      ? new URL(`app/events/${event.id}`, `${window.location.origin}${import.meta.env.BASE_URL || '/'}`).href
      : '';

  const onShare = useCallback(async () => {
    if (!eventUrl) return;
    const title = 'SpielzeitApp · Spieltag';
    const text = `${ourClub} vs. ${opponent} · Anpfiff ${kickoff}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const data: ShareData = { title, text, url: eventUrl };
        if (typeof navigator.canShare !== 'function' || navigator.canShare(data)) {
          await navigator.share(data);
          return;
        }
      }
      await navigator.clipboard.writeText(`${text}\n${eventUrl}`);
      setShareHint('Link kopiert.');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setShareHint('Teilen nicht möglich.');
    }
    window.setTimeout(() => setShareHint(null), 2200);
  }, [eventUrl, kickoff, opponent, ourClub]);

  const { backendRole, membershipRole } = useSession();
  const viewerIsStaff = canStaffManageTeamFeed(backendRole, membershipRole);

  const announcementTiming = status === 'today' || status === 'tomorrow' ? status : null;
  const gameHref = reviewPending && event.match_id
    ? `/app/live?matchId=${encodeURIComponent(event.match_id)}`
    : resolveMatchGameHref({
        matchId: event.match_id,
        eventId: event.id,
        status: event.status ?? 'upcoming',
        canManage: viewerIsStaff,
      });

  return (
    <section className="min-w-0" aria-label="Spieltag">
      <MatchdayPosterCard
        compact
        homeTeamName={homeName}
        awayTeamName={awayName}
        homeLogoUrl={homeLogo}
        awayLogoUrl={awayLogo}
        kickoffTime={kickoff}
        meetingTime={meetingTime}
        locationLine={locationLine}
        venueLabel={venueLabel}
        status="today"
        matchType={event.match_type}
        announcementTiming={announcementTiming}
      />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link
          to={gameHref}
          className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl border border-red-500/45 bg-red-600/90 px-4 text-sm font-bold text-white shadow-[0_4px_16px_rgba(185,28,28,0.35)] transition hover:bg-red-500 sm:flex-initial sm:min-w-[8.5rem]"
        >
          {reviewPending ? 'Ergebnis prüfen' : 'Zum Spiel'}
        </Link>
        <button
          type="button"
          onClick={() => void onShare()}
          className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl border border-white/18 bg-black/40 px-4 text-sm font-semibold text-white/92 backdrop-blur-sm transition hover:bg-white/10 sm:flex-initial sm:min-w-[8.5rem]"
        >
          <Share2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Teilen
        </button>
      </div>
      {shareHint ? <p className="mt-1.5 text-center text-[12px] text-white/60">{shareHint}</p> : null}
    </section>
  );
};
