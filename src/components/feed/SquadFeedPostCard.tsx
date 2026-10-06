import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventRow, EventStatus } from '../../hooks/useEvents';
import type { SquadFeedPostRow } from '../../lib/matchdayFeedTypes';
import { getClubLogo } from '../../lib/teamLogos';
import { shareFeedContent } from '../../lib/feedShare';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { SquadPosterArtwork } from './SquadPosterArtwork';
import { supabase } from '../../lib/supabaseClient';
import { useDemoMode } from '../../demo/DemoContext';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FEED_STADIUM_ARTICLE_SHADOW,
  FeedCaption,
  FeedGameCtaLink,
  FeedPostActionsFooter,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedStandardActions,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { AutoFeedPostMediaEditButton } from './AutoFeedPostMediaEditButton';
import { AutoFeedPostCustomImage } from './AutoFeedPostCustomImage';

type Props = {
  post: SquadFeedPostRow;
  liveEvent?: EventRow | null;
  eventStatus?: EventStatus | null;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
  onFeedPostUpdated?: () => void;
};

export const SquadFeedPostCard: React.FC<Props> = ({
  post,
  liveEvent,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
  onFeedPostUpdated,
}) => {
  const p = post.payload;
  const demo = useDemoMode();
  const [teamPhoto, setTeamPhoto] = useState<{ seasonId: string; url: string } | null>(null);
  const isDemo = Boolean(demo?.isDemo);
  useEffect(() => {
    if (isDemo || post.media_url?.trim() || !p.team_season_id) return;
    let cancelled = false;
    void supabase.from('team_photos').select('photo_url')
      .eq('team_season_id', p.team_season_id).maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setTeamPhoto({ seasonId: p.team_season_id, url: error ? '' : data?.photo_url?.trim() || '' });
      });
    return () => { cancelled = true; };
  }, [p.team_season_id, isDemo, post.media_url]);
  const teamPhotoUrl = isDemo ? '/feed/demo-u12-team-moment.webp'
    : teamPhoto?.seasonId === p.team_season_id ? teamPhoto.url : null;
  const ageGroup = (teamLabel + ' ' + p.our_team_name).match(/\bU\d{1,2}\b/i)?.[0]?.toUpperCase() || '';
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
        actions={staffCanDelete && onFeedPostDeleted ? (
          <div className="flex items-center gap-2">
            <AutoFeedPostMediaEditButton post={post} title="Kaderbild" onUpdated={onFeedPostUpdated ?? onFeedPostDeleted} />
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          </div>
        ) : null}
      />
      <FeedPostTypeBadge>Spieltag</FeedPostTypeBadge>
      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-2`}>
        {post.media_url?.trim() ? (
          <AutoFeedPostCustomImage mediaUrl={post.media_url} alt="Eigenes Kaderbild" />
        ) : (
          <SquadPosterArtwork
            left={teams.left}
            right={teams.right}
            ageGroup={ageGroup}
            players={p.players}
            startsAt={liveEvent?.starts_at || p.starts_at}
            location={liveEvent?.location}
            teamPhotoUrl={teamPhotoUrl}
          />
        )}
        <div className="mt-3"><FeedGameCtaLink to={p.deep_link}>Zum Spiel</FeedGameCtaLink></div>
        <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}><FeedCaption text={post.caption} /></div>
      </div>
      <FeedPostActionsFooter shareHint={shareHint}>
        <FeedStandardActions liked={liked} onToggleLike={() => setLiked((v) => !v)} onShare={() => void onShare()} inFooter whatsAppStatus />
      </FeedPostActionsFooter>
    </FeedPostArticleShell>
  );
};
