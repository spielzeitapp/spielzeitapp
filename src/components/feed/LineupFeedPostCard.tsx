import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventRow } from '../../hooks/useEvents';
import type { LineupFeedPostRow } from '../../lib/matchdayFeedTypes';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
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

type Props = {
  post: LineupFeedPostRow;
  liveEvent?: EventRow | null;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
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
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
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

  const gameHref = useMemo(
    () =>
      resolveMatchGameHref({
        matchId: p.match_id ?? liveEvent?.match_id,
        eventId: p.event_id,
        status: liveEvent?.status ?? 'upcoming',
        canManage: viewerIsStaff || basePath === '/demo',
        basePath,
      }),
    [p.match_id, p.event_id, liveEvent?.match_id, liveEvent?.status, viewerIsStaff, basePath],
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
      className="!border-[rgba(255,71,71,0.15)]"
      style={{ boxShadow: FEED_STADIUM_ARTICLE_SHADOW }}
    >
      <FeedPostHeader
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        whenLabel={whenLabel}
        headerClassName="bg-black/25"
        actions={
          staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null
        }
      />
      <FeedPostTypeBadge>Aufstellung</FeedPostTypeBadge>

      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-6`}>
        <div className={FEED_STADIUM_HERO_SHELL_CLASS}>
          <FeedStadiumHeroBackdrop />

          <div className="relative min-w-0 space-y-3">
            <div className="text-center">
              <p className={FEED_HERO_TITLE_CLASS}>Spieltag</p>
            </div>

            <FeedMatchMetaBadge line={lineupMetaLine} leadingIcon={<FeedLineupMetaIcon />} />

            {p.formation ? (
              <div className="flex justify-center">
                <FeedFormationBadge formation={p.formation} />
              </div>
            ) : null}

            {vsTeams ? (
              <div className={FEED_MATCH_GRID_CLASS}>
                <div className={FEED_MATCH_TEAM_COL_CLASS}>
                  <FeedMatchLogoBlock src={vsTeams.left.logo} alt={`${vsTeams.left.name} Logo`} />
                  <FeedClubName fullName={vsTeams.left.name} variant="compact" className="w-full px-0.5" />
                </div>
                <span className="-skew-x-6 shrink-0 px-1 text-2xl font-black italic uppercase leading-none tracking-[0.02em] text-red-400 [text-shadow:0_3px_12px_rgba(0,0,0,0.7),0_0_20px_rgba(227,29,47,0.4)] sm:text-[1.75rem]">
                  VS
                </span>
                <div className={FEED_MATCH_TEAM_COL_CLASS}>
                  <FeedMatchLogoBlock src={vsTeams.right.logo} alt={`${vsTeams.right.name} Logo`} />
                  <FeedClubName fullName={vsTeams.right.name} variant="compact" className="w-full px-0.5" />
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[rgba(255,71,71,0.14)] bg-black/35 px-1.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:px-2.5 sm:py-3">
              <FeedSectionHeader icon="👕" label="Startaufstellung" />
              <ul className="space-y-1">
                {displayPlayers.map((pl, index) => {
                  const name = lineupFeedDisplayPlayerName(pl);
                  const positionAbbrev = lineupFeedDisplayPositionAbbrev(pl);
                  return (
                    <li
                      key={`${pl.player_id ?? index}-${pl.slot ?? index}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg bg-white/[0.03] px-2 py-1 sm:gap-x-2.5 sm:px-2.5"
                    >
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-400/35 bg-gradient-to-b from-red-600/55 to-red-950/80 text-[10px] font-black tabular-nums text-white shadow-[0_0_10px_rgba(220,38,38,0.29)] sm:h-7 sm:w-7 sm:text-[11px]">
                        {lineupBadgeLabel(pl)}
                      </span>
                      {name ? (
                        <span className="min-w-0 break-words text-[12px] font-bold leading-snug text-white sm:text-[13.5px]">
                          {name}
                        </span>
                      ) : (
                        <span className="min-w-0 break-words text-[11px] italic leading-snug text-white/45 sm:text-[12px]">
                          nicht benannt
                        </span>
                      )}
                      <span className="w-7 shrink-0 text-right text-[10px] font-bold tabular-nums tracking-wide text-red-200/80 sm:w-8 sm:text-[11px]">
                        {positionAbbrev}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {benchPlayers.length > 0 ? (
              <div className="rounded-2xl border border-[rgba(255,71,71,0.14)] bg-black/35 px-1.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:px-2.5 sm:py-3">
                <FeedSectionHeader icon="🪑" label="Ersatzbank" />
                <ul className="space-y-1">
                  {benchPlayers.map((pl, index) => (
                    <li
                      key={`${pl.player_id ?? index}-bench`}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 rounded-lg bg-white/[0.03] px-2 py-1 sm:gap-x-2.5 sm:px-2.5"
                    >
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/45 text-[10px] font-black tabular-nums text-white/85 sm:h-7 sm:w-7 sm:text-[11px]">
                        {lineupBadgeLabel(pl)}
                      </span>
                      <span className="min-w-0 break-words text-[12px] font-semibold leading-snug text-white/90 sm:text-[13px]">
                        {lineupFeedDisplayPlayerName(pl)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="pt-1">
              <FeedGameCtaLink to={gameHref} />
            </div>
          </div>
        </div>

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
          inFooter
        />
      </FeedPostActionsFooter>
    </FeedPostArticleShell>
  );
};
