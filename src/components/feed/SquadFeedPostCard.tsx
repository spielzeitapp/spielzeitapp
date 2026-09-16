import React, { useCallback, useMemo, useState } from 'react';
import type { EventRow, EventStatus } from '../../hooks/useEvents';
import type { SquadFeedPostRow } from '../../lib/matchdayFeedTypes';
import { getClubLogo } from '../../lib/teamLogos';
import { shareFeedContent } from '../../lib/feedShare';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { FeedClubName } from './FeedClubName';
import { FeedMatchLogoBlock, FEED_MATCH_GRID_CLASS, FEED_MATCH_TEAM_COL_CLASS } from './feedMatchHero';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FEED_STADIUM_ARTICLE_SHADOW,
  FEED_STADIUM_HERO_SHELL_CLASS,
  FeedCaption,
  FeedGameCtaLink,
  FeedPostActionsFooter,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedSectionHeader,
  FeedStandardActions,
  FeedStadiumHeroBackdrop,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';

type Props = {
  post: SquadFeedPostRow;
  liveEvent?: EventRow | null;
  eventStatus?: EventStatus | null;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

export const SquadFeedPostCard: React.FC<Props> = ({
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
  const teams = useMemo(() => {
    const our = { name: p.our_team_name || teamLabel, logo: getClubLogo(p.our_team_name || teamLabel) };
    const opponentName = p.opponent_name || liveEvent?.opponent || 'Gegner';
    const opponent = {
      name: opponentName,
      logo: getClubLogo(opponentName, { logoUrl: liveEvent?.opponent_logo_url }),
    };
    return p.is_home === false ? { left: opponent, right: our } : { left: our, right: opponent };
  }, [p.our_team_name, p.opponent_name, p.is_home, teamLabel, liveEvent]);

  const onShare = useCallback(async () => {
    const result = await shareFeedContent({
      title: 'SpielzeitApp · Unser Kader',
      text: `${post.caption}\n${window.location.origin}${p.deep_link}`,
    });
    if (result === 'aborted') return;
    setShareHint(result === 'shared' ? 'Geteilt.' : result === 'copied' ? 'Text kopiert.' : 'Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2400);
  }, [p.deep_link, post.caption]);

  return (
    <FeedPostArticleShell style={{ boxShadow: FEED_STADIUM_ARTICLE_SHADOW }}>
      <FeedPostHeader
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        whenLabel={formatDateTimeMediumDeVienna(post.created_at)}
        headerClassName="bg-black/25"
        actions={staffCanDelete && onFeedPostDeleted
          ? <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          : null}
      />
      <FeedPostTypeBadge>Kader</FeedPostTypeBadge>
      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-2`}>
        <div className={FEED_STADIUM_HERO_SHELL_CLASS}>
          <FeedStadiumHeroBackdrop />
          <div className="relative min-w-0 space-y-3">
            <div className="text-center">
              <p className="sz-club-feed-accent-text text-[11px] font-black uppercase tracking-[0.28em]">Spieltag</p>
              <h3 className="mt-1 text-[28px] font-black uppercase italic tracking-tight text-white">Unser Kader</h3>
            </div>
            <div className={FEED_MATCH_GRID_CLASS}>
              <div className={FEED_MATCH_TEAM_COL_CLASS}>
                <FeedMatchLogoBlock src={teams.left.logo} alt={`${teams.left.name} Logo`} />
                <FeedClubName fullName={teams.left.name} variant="compact" className="w-full px-0.5" />
              </div>
              <span className="sz-club-feed-accent-text -skew-x-6 shrink-0 px-1 text-2xl font-black italic">VS</span>
              <div className={FEED_MATCH_TEAM_COL_CLASS}>
                <FeedMatchLogoBlock src={teams.right.logo} alt={`${teams.right.name} Logo`} />
                <FeedClubName fullName={teams.right.name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>
            <div className="sz-club-feed-inset rounded-2xl border px-2 py-3 backdrop-blur-md">
              <FeedSectionHeader icon="K" label={`${p.players.length} Spieler im Kader`} />
              <ul className="mt-2 grid grid-cols-2 gap-1.5">
                {p.players.map((player) => (
                  <li key={player.player_id} className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.04] px-2 py-2">
                    <span className="sz-club-feed-number-badge inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black">
                      {player.jersey_number ?? 'K'}
                    </span>
                    <span className="min-w-0 break-words text-[12px] font-bold leading-tight text-white">{player.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <FeedGameCtaLink to={p.deep_link}>Zum Spiel</FeedGameCtaLink>
          </div>
        </div>
        <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}><FeedCaption text={post.caption} /></div>
      </div>
      <FeedPostActionsFooter shareHint={shareHint}>
        <FeedStandardActions liked={liked} onToggleLike={() => setLiked((v) => !v)} onShare={() => void onShare()} inFooter />
      </FeedPostActionsFooter>
    </FeedPostArticleShell>
  );
};
