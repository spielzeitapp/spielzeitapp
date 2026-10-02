import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Trash2 } from 'lucide-react';
import { removeAutomaticMatchdayPost } from '../../lib/autoMatchdayFeedEnabled';
import type { HomeMatchCardPick } from './homeFeedBuilder';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatVisibleMatchEncounter } from '../../lib/oefbTeamNameNormalize';
import { formatMeetupTimeOnlyDe } from '../../components/match/matchCardLabels';
import { MatchdayPosterCard } from '../../components/feed/MatchdayPosterCard';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';
import { useInternalBasePath } from '../../demo/demoPaths';
import { canSeeMeetup, normalizeRole } from '../../lib/roles';
import { matchdayPosterDomToPngBlob } from '../../lib/matchdayPosterExport';
import { shareFeedContent } from '../../lib/feedShare';
import { useMatchdayDesign } from '../../hooks/useMatchdayDesign';
import { MatchdayDesignButton } from '../../components/feed/MatchdayDesignButton';
import type { MatchdayPosterCardProps } from '../../components/feed/MatchdayPosterCard';

type Props = {
  pick: HomeMatchCardPick;
  reviewPending?: boolean;
  canDelete?: boolean;
  onDeleted?: (matchId: string) => void;
  ageGroup?: string | null;
};

export const HomeSpieltagHintCard: React.FC<Props> = ({ pick, reviewPending = false, canDelete = false, onDeleted, ageGroup = null }) => {
  const { event, status } = pick;
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const basePath = useInternalBasePath();
  const designState = useMatchdayDesign(event.id, event.team_season_id, basePath === '/demo');
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

  const eventUrl =
    typeof window !== 'undefined'
      ? new URL(`${basePath.slice(1)}/events/${event.id}`, `${window.location.origin}${import.meta.env.BASE_URL || '/'}`).href
      : '';

  const onShare = useCallback(async () => {
    if (!eventUrl) return;
    const title = 'SpielzeitApp · Spieltag';
    const text = `${ourClub} vs. ${opponent} · Anpfiff ${kickoff}`;
    const blob = posterRef.current ? await matchdayPosterDomToPngBlob(posterRef.current) : null;
    const result = await shareFeedContent({
      title,
      text: `${text}\n${eventUrl}`,
      file: blob ? new File([blob], 'spielzeit-spieltag.png', { type: 'image/png' }) : null,
    });
    if (result === 'aborted') return;
    setShareHint(result === 'shared' ? 'Geteilt.' : result === 'copied' ? 'Link kopiert.' : 'Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2200);
  }, [eventUrl, kickoff, opponent, ourClub]);

  const { backendRole, membershipRole } = useSession();
  const viewerIsStaff = canStaffManageTeamFeed(backendRole, membershipRole);
  const onDelete = async () => {
    if (!canDelete || !viewerIsStaff || deleting || basePath === '/demo') return;
    if (!window.confirm('Automatischen Spieltag-Beitrag für alle löschen? Er wird für dieses Spiel nicht erneut erstellt. Das Spiel selbst bleibt erhalten.')) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await removeAutomaticMatchdayPost(event.match_id ?? '');
      onDeleted?.(event.match_id!);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Beitrag konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
    }
  };
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

  const posterProps: MatchdayPosterCardProps = {
    compact: true, homeTeamName: homeName, awayTeamName: awayName,
    homeLogoUrl: homeLogo, awayLogoUrl: awayLogo, kickoffTime: kickoff,
    ageGroup: ageGroup ?? (basePath === '/demo' ? 'U12' : null), matchDate,
    meetingTime, locationLine, venueLabel, status: 'today', matchType: event.match_type,
    announcementTiming,
  };
  return (
    <section className="min-w-0" aria-label="Spieltag">
      {viewerIsStaff || basePath === '/demo' ? <div className="mb-2 flex justify-end">
        <MatchdayDesignButton {...designState} poster={posterProps} teamSeasonId={event.team_season_id} demo={basePath === '/demo'} />
      </div> : null}
      {canDelete && viewerIsStaff && basePath !== '/demo' ? (
        <div className="mb-2 flex justify-end">
          <button type="button" disabled={deleting} onClick={() => void onDelete()}
            className="inline-flex min-h-[44px] touch-manipulation items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-3 text-sm font-semibold text-amber-200 disabled:opacity-45"
            aria-label="Automatischen Spieltag-Beitrag löschen">
            <Trash2 className="h-4 w-4" aria-hidden />
            {deleting ? 'Wird gelöscht…' : 'Beitrag löschen'}
          </button>
        </div>
      ) : null}
      {deleteError ? <p role="alert" className="mb-2 text-sm text-red-400">{deleteError}</p> : null}
      <MatchdayPosterCard
        {...posterProps}
        ref={posterRef}
        compact
        homeTeamName={homeName}
        awayTeamName={awayName}
        homeLogoUrl={homeLogo}
        awayLogoUrl={awayLogo}
        kickoffTime={kickoff}
        ageGroup={ageGroup ?? (basePath === '/demo' ? 'U12' : null)}
        matchDate={matchDate}
        meetingTime={meetingTime}
        locationLine={locationLine}
        venueLabel={venueLabel}
        status="today"
        matchType={event.match_type}
        announcementTiming={announcementTiming}
        playerImageUrl={designState.design.template === 'player' ? designState.design.imageUrl : null}
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
