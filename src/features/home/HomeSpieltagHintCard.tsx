import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import type { HomeMatchCardPick } from './homeFeedBuilder';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatVisibleMatchEncounter } from '../../lib/oefbTeamNameNormalize';
import { formatMeetupTimeOnlyDe } from '../../components/match/matchCardLabels';
import { MatchdayPosterCard } from '../../components/feed/MatchdayPosterCard';
import { FeedWhatsAppStatusButton } from '../../components/feed/FeedWhatsAppStatusButton';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';
import { useInternalBasePath } from '../../demo/demoPaths';
import { canSeeMeetup, normalizeRole } from '../../lib/roles';
import { matchdayPosterDomToPngBlob } from '../../lib/matchdayPosterExport';
import { shareFeedContent } from '../../lib/feedShare';
import { buildMatchdayShareText } from '../../lib/matchdayShareText';

type Props = {
  pick: HomeMatchCardPick;
  reviewPending?: boolean;
};

export const HomeSpieltagHintCard: React.FC<Props> = ({ pick, reviewPending = false }) => {
  const { event, status } = pick;
  const [shareHint, setShareHint] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const basePath = useInternalBasePath();
  const enc = formatVisibleMatchEncounter({
    isHome: event.is_home,
    ourTeamName: getOurTeamDisplayName(),
    opponentName: event.opponent,
  });
  const opponent = enc.opponent;
  const ourClub = enc.ourTeam;
  const isHome = event.is_home !== false;
  const homeName = enc.home;
  const awayName = enc.away;
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
  const matchDate =
    event.starts_at && !Number.isNaN(new Date(event.starts_at).getTime())
      ? new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(event.starts_at))
      : null;
  const rawMeetingTime =
    event.meeting_at && !Number.isNaN(new Date(event.meeting_at).getTime())
      ? formatMeetupTimeOnlyDe(event.meeting_at)
      : null;
  const locationLine = formatFeedVenueShort(event.location ?? event.address) ?? '—';
  const venueLabel = isHome ? 'Heimspiel' : 'Auswärtsspiel';

  const onShare = useCallback(async () => {
    const title = 'SpielzeitApp · Spieltag';
    const text = buildMatchdayShareText({ home: homeName, away: awayName,
      startsAt: event.starts_at ?? '', location: locationLine, isHome });
    const blob = posterRef.current ? await matchdayPosterDomToPngBlob(posterRef.current) : null;
    const result = await shareFeedContent({
      title,
      text,
      file: blob ? new File([blob], 'spielzeit-spieltag.png', { type: 'image/png' }) : null,
    });
    if (result === 'aborted') return;
    setShareHint(result === 'shared' ? 'Geteilt.' : result === 'copied' ? 'Text kopiert.' : 'Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2200);
  }, [homeName, awayName, event.starts_at, locationLine, isHome]);

  const { backendRole, membershipRole } = useSession();
  const viewerIsStaff = canStaffManageTeamFeed(backendRole, membershipRole);
  const viewerRole = normalizeRole(membershipRole) ?? normalizeRole(backendRole);
  const meetingTime = canSeeMeetup(viewerRole) ? rawMeetingTime : null;

  const announcementTiming = status === 'today' || status === 'tomorrow' ? status : null;
  const gameHref = reviewPending && event.match_id
    ? `${basePath}/live?matchId=${encodeURIComponent(event.match_id)}`
    : resolveMatchGameHref({
        matchId: event.match_id,
        eventId: event.id,
        status: event.status ?? 'upcoming',
        canManage: viewerIsStaff || basePath === '/demo',
        basePath,
      });

  return (
    <section data-whatsapp-status-root className="min-w-0" aria-label="Spieltag">
      <MatchdayPosterCard
        ref={posterRef}
        compact
        homeTeamName={homeName}
        awayTeamName={awayName}
        homeLogoUrl={homeLogo}
        awayLogoUrl={awayLogo}
        kickoffTime={kickoff}
        ageGroup={basePath === '/demo' ? 'U12' : null}
        matchDate={matchDate}
        meetingTime={meetingTime}
        locationLine={locationLine}
        venueLabel={venueLabel}
        status="today"
        matchType={event.match_type}
        announcementTiming={announcementTiming}
        playerImageUrl={basePath === '/demo' ? '/avatars/demo/demo-player-upper-02.webp' : null}
      />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link
          to={gameHref}
          className="sz-club-primary inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl border px-4 text-sm font-bold transition sm:flex-initial sm:min-w-[8.5rem]"
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
      <FeedWhatsAppStatusButton />
    </section>
  );
};
