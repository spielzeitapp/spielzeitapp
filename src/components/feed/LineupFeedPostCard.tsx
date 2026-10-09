import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventRow, EventStatus } from '../../hooks/useEvents';
import type { LineupFeedPostRow } from '../../lib/matchdayFeedTypes';
import { matchFeedCtaLabel, resolveMatchGameHref } from '../../lib/matchFeedLink';
import type { LineupFeedPlayer } from '../../lib/lineupFeedTypes';
import {
  lineupFeedDisplayPlayerName,
  lineupFeedDisplayPositionAbbrev,
} from '../../lib/lineupFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { getClubLogo } from '../../lib/teamLogos';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { buildFeedMatchMetaLine, pickFeedAgeGroup } from '../../lib/feedClubNaming';
import { FeedClubName } from './FeedClubName';
import { FeedMatchLogoBlock, FEED_MATCH_GRID_CLASS, FEED_MATCH_TEAM_COL_CLASS } from './feedMatchHero';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedFormationBadge,
  FeedGameCtaLink,
  FeedLineupMetaIcon,
  FeedMatchMetaBadge,
  FeedPostActionsFooter,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedSectionHeader,
  FeedStandardActions,
  FeedStadiumHeroBackdrop,
  FEED_HERO_TITLE_CLASS,
  FEED_STADIUM_ARTICLE_SHADOW,
  FEED_STADIUM_HERO_SHELL_CLASS,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';
import { useInternalBasePath } from '../../demo/demoPaths';
import { AutoFeedPostMediaEditButton } from './AutoFeedPostMediaEditButton';
import { AutoFeedPostCustomImage } from './AutoFeedPostCustomImage';
import { LineupPosterArtwork } from './LineupPosterArtwork';

type Props = {
  post: LineupFeedPostRow;
  liveEvent?: EventRow | null;
  eventStatus?: EventStatus | null;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
  onFeedPostUpdated?: () => void;
};

/** 8 statt 7: FairPlay-Formationen haben einen Zusatzspieler (FP-Slot). */
const MAX_DISPLAY_PLAYERS = 8;

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

/** Badge-Inhalt: Rückennummer, sonst Positions-Kürzel (Slot), sonst Strich. */
function lineupBadgeLabel(pl: LineupFeedPlayer): string {
  const jersey = pl.jersey_number;
  if (typeof jersey === 'number' && Number.isFinite(jersey) && jersey > 0) {
    return String(Math.trunc(jersey));
  }
  const slot = (pl.slot ?? '').trim().toUpperCase();
  if (slot) return slot;
  return '–';
}

export const LineupFeedPostCard: React.FC<Props> = ({
  post,
  liveEvent,
  eventStatus: linkedEventStatus,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
  onFeedPostUpdated,
}) => {
  const p = post.payload;
  const [liked, setLiked] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLiked(sessionStorage.getItem(likeStorageKey(post.id)) === '1');
    } catch {
      setLiked(false);
    }
  }, [post.id]);

  const displayPlayers = useMemo(
    () => p.lineup_players.slice(0, MAX_DISPLAY_PLAYERS),
    [p.lineup_players],
  );

  const benchPlayers = useMemo(
    () => (p.bench_players ?? []).filter((pl) => lineupFeedDisplayPlayerName(pl)),
    [p.bench_players],
  );

  /** VS-Block: Payload bevorzugt (neue Posts), sonst liveEvent (Bestands-Posts). */
  const vsTeams = useMemo(() => {
    const ourName = (p.our_team_name ?? '').trim() || teamLabel.trim();
    const oppName = (p.opponent_name ?? '').trim() || (liveEvent?.opponent ?? '').trim();
    if (!ourName || !oppName) return null;
    const isHome = p.is_home ?? liveEvent?.is_home ?? true;
    const our = { name: ourName, logo: getClubLogo(ourName) };
    const opp = {
      name: oppName,
      logo: getClubLogo(oppName, { logoUrl: liveEvent?.opponent_logo_url }),
    };
    return isHome ? { left: our, right: opp } : { left: opp, right: our };
  }, [p.our_team_name, p.opponent_name, p.is_home, teamLabel, liveEvent]);

  const lineupMetaLine = useMemo(
    () =>
      buildFeedMatchMetaLine(
        pickFeedAgeGroup(teamLabel, p.our_team_name ?? '', p.opponent_name ?? liveEvent?.opponent ?? ''),
        getMatchTypeLabel(liveEvent?.match_type ?? undefined) || null,
      ),
    [teamLabel, p.our_team_name, p.opponent_name, liveEvent?.opponent, liveEvent?.match_type],
  );

  const { backendRole, membershipRole } = useSession();
  const viewerIsStaff = canStaffManageTeamFeed(backendRole, membershipRole);
  const basePath = useInternalBasePath();
  const eventStatus = linkedEventStatus ?? liveEvent?.status ?? 'upcoming';

  const gameHref = useMemo(
    () =>
      resolveMatchGameHref({
        matchId: p.match_id ?? liveEvent?.match_id,
        eventId: p.event_id,
        status: eventStatus,
        canManage: viewerIsStaff || basePath === '/demo',
        basePath,
      }),
    [p.match_id, p.event_id, liveEvent?.match_id, eventStatus, viewerIsStaff, basePath],
  );

  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);

  const onToggleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    try {
      sessionStorage.setItem(likeStorageKey(post.id), next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [liked, post.id]);

  const onShare = useCallback(async () => {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '');
    const path = gameHref.startsWith('/') ? gameHref : `/${gameHref}`;
    const url = `${window.location.origin}${base}${path}`;
    const outcome = await shareFeedContent({
      title: 'SpielzeitApp · Startaufstellung',
      text: `${post.caption}\n${url}`,
    });
    if (outcome === 'aborted') return;
    if (outcome === 'shared') setShareHint('Geteilt.');
    else if (outcome === 'copied') setShareHint('Text kopiert.');
    else setShareHint('Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2400);
  }, [gameHref, post.caption]);

  return (
    <FeedPostArticleShell
      className=""
      style={{ boxShadow: FEED_STADIUM_ARTICLE_SHADOW }}
    >
      <FeedPostHeader
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        whenLabel={whenLabel}
        headerClassName="bg-black/25"
        actions={
          staffCanDelete && onFeedPostDeleted ? (
            <div className="flex items-center gap-2">
              <AutoFeedPostMediaEditButton post={post} title="Aufstellungsbild" onUpdated={onFeedPostUpdated ?? onFeedPostDeleted} />
              <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
            </div>
          ) : null
        }
      />
      <FeedPostTypeBadge>Aufstellung</FeedPostTypeBadge>

      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-2`}>
        {post.media_url?.trim() ? (
          <AutoFeedPostCustomImage mediaUrl={post.media_url} alt="Eigenes Aufstellungsbild" />
        ) : (
        <>
          <LineupPosterArtwork
            left={vsTeams?.left ?? { name: teamLabel, logo: getClubLogo(teamLabel) }}
            right={vsTeams?.right ?? { name: p.opponent_name || "Gegner", logo: getClubLogo(p.opponent_name || "Gegner") }}
            ageGroup={pickFeedAgeGroup(teamLabel, p.our_team_name ?? "", p.opponent_name ?? "") || ""}
            formation={p.formation}
            players={displayPlayers}
            bench={benchPlayers}
          />
          <div className="mt-3"><FeedGameCtaLink to={gameHref}>{matchFeedCtaLabel(eventStatus)}</FeedGameCtaLink></div>
        </>
        )}

        {post.caption?.trim() ? (
          <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}>
            <FeedCaption text={post.caption} />
          </div>
        ) : null}
      </div>

      <FeedPostActionsFooter shareHint={shareHint}>
        <FeedStandardActions
          liked={liked}
          onToggleLike={onToggleLike}
          onShare={() => void onShare()}
          inFooter whatsAppStatus
        />
      </FeedPostActionsFooter>
    </FeedPostArticleShell>
  );
};
