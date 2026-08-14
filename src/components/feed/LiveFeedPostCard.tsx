import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, MapPin } from 'lucide-react';
import type { LiveFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { FeedClubName } from './FeedClubName';
import { FeedMatchLogoBlock, FEED_MATCH_GRID_CLASS, FEED_MATCH_TEAM_COL_CLASS } from './feedMatchHero';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedGameCtaLink,
  FeedPostActionsFooter,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedStandardActions,
  FeedStadiumHeroBackdrop,
  FEED_HERO_TITLE_CLASS,
  FEED_STADIUM_ARTICLE_SHADOW,
  FEED_STADIUM_HERO_SHELL_CLASS,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  post: LiveFeedPostRow;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

function formatKickoffTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, hour: '2-digit', minute: '2-digit' }).format(d) +
    ' Uhr'
  );
}

export const LiveFeedPostCard: React.FC<Props> = ({
  post,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
}) => {
  const basePath = useInternalBasePath();
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

  const venueLabel = useMemo(() => formatFeedVenueShort(p.location) ?? '—', [p.location]);

  const deepLink = p.deep_link?.startsWith('/')
    ? p.deep_link
    : `${basePath}/live/${p.match_id}`;
  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);
  const kickoffLabel = formatKickoffTime(p.starts_at);

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
    const path = deepLink.startsWith('/') ? deepLink : `/${deepLink}`;
    const url = `${window.location.origin}${base}${path}`;
    const outcome = await shareFeedContent({
      title: 'SpielzeitApp · LIVE',
      text: `${post.caption}\n${url}`,
    });
    if (outcome === 'aborted') return;
    if (outcome === 'shared') setShareHint('Geteilt.');
    else if (outcome === 'copied') setShareHint('Text kopiert.');
    else setShareHint('Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2400);
  }, [deepLink, post.caption]);

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
      <FeedPostTypeBadge variant="live">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
          Live
        </span>
      </FeedPostTypeBadge>

      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-6`}>
        <div className={FEED_STADIUM_HERO_SHELL_CLASS}>
          <FeedStadiumHeroBackdrop />

          <div className="relative space-y-3">
            <p className={`text-center ${FEED_HERO_TITLE_CLASS}`}>Live jetzt</p>

            <div className={FEED_MATCH_GRID_CLASS}>
              <div className={FEED_MATCH_TEAM_COL_CLASS}>
                <FeedMatchLogoBlock src={p.home_logo_url} alt={`${p.home_team_name} Logo`} />
                <FeedClubName fullName={p.home_team_name} variant="compact" className="w-full px-0.5" />
              </div>
              <span className="-skew-x-6 shrink-0 px-1 text-2xl font-black italic uppercase leading-none tracking-[0.02em] text-red-400 [text-shadow:0_3px_12px_rgba(0,0,0,0.7),0_0_20px_rgba(227,29,47,0.4)] sm:text-[1.75rem]">
                VS
              </span>
              <div className={FEED_MATCH_TEAM_COL_CLASS}>
                <FeedMatchLogoBlock src={p.away_logo_url} alt={`${p.away_team_name} Logo`} />
                <FeedClubName fullName={p.away_team_name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-1.5 text-center">
              <div className="min-w-0 rounded-2xl border border-[rgba(255,71,71,0.12)] bg-black/35 px-1 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <dt className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                  Anpfiff
                </dt>
                <dd className="mt-1 truncate text-[12px] font-semibold text-white">{kickoffLabel}</dd>
              </div>
              <div className="min-w-0 rounded-2xl border border-[rgba(255,71,71,0.12)] bg-black/35 px-1 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <dt className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  Ort
                </dt>
                <dd
                  className="mt-1 line-clamp-2 break-words text-[11px] font-semibold leading-snug text-white/90 sm:text-[12px]"
                  title={venueLabel}
                >
                  {venueLabel}
                </dd>
              </div>
            </dl>

            <div className="pt-1">
              <FeedGameCtaLink to={deepLink}>Zum Liveticker</FeedGameCtaLink>
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
