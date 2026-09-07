import React, { useCallback, useEffect, useState } from 'react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { FeedPostCtaButton } from './FeedPostCtaButton';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedPostActionsFooter,
  FeedStandardActions,
  FEED_STADIUM_ARTICLE_SHADOW,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';

type Props = {
  post: TeamFeedPostDbRow;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

export const ImageFeedPostCard: React.FC<Props> = ({ post, teamLabel, seasonLabel, staffCanDelete, onFeedPostDeleted }) => {
  const [liked, setLiked] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedSrc = useFeedMediaSrc(post.media_url);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [post.media_url]);

  useEffect(() => {
    try {
      setLiked(sessionStorage.getItem(likeStorageKey(post.id)) === '1');
    } catch {
      setLiked(false);
    }
  }, [post.id]);

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
    const title = 'SpielzeitApp · Foto';
    const text = post.caption?.trim() || 'Team-Foto';
    const lower = (post.media_url ?? '').toLowerCase();
    const ext = lower.endsWith('.png') ? 'png' : lower.endsWith('.webp') ? 'webp' : 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const outcome = await shareFeedContent({
      title,
      text,
      fetchUrl: resolvedSrc,
      fileName: `spielzeit-feed-${post.id.slice(0, 8)}.${ext}`,
      mimeType: mime,
    });
    if (outcome === 'aborted') return;
    if (outcome === 'shared') {
      setShareHint('Geteilt.');
    } else if (outcome === 'copied') {
      setShareHint('Text kopiert.');
    } else {
      setShareHint('Teilen nicht möglich.');
    }
    window.setTimeout(() => setShareHint(null), 2400);
  }, [post.caption, post.id, post.media_url, resolvedSrc]);

  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);

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
      <FeedPostTypeBadge>Foto</FeedPostTypeBadge>

      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-6`}>
        <div className="relative aspect-[4/5] max-h-[min(78vh,720px)] w-full overflow-hidden rounded-none border-y border-red-900/25 bg-black sm:rounded-2xl sm:border">
          {resolvedSrc && !imageFailed ? (
            <img
              src={resolvedSrc}
              alt=""
              className={`h-full w-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
            />
          ) : null}
          {!imageLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(160deg,rgba(42,12,17,0.55),rgba(0,0,0,0.96))] text-xs font-medium text-white/45">
              {imageFailed ? 'Bild konnte nicht geladen werden.' : 'Bild wird geladen…'}
            </div>
          ) : null}
        </div>

        {post.caption?.trim() ? (
          <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}>
            <FeedCaption text={post.caption} />
          </div>
        ) : null}

        <FeedPostCtaButton ctaUrl={post.cta_url} ctaLabel={post.cta_label} />

        <FeedPostActionsFooter shareHint={shareHint}>
          <FeedStandardActions liked={liked} onToggleLike={onToggleLike} onShare={() => void onShare()} inFooter />
        </FeedPostActionsFooter>
      </div>
    </FeedPostArticleShell>
  );
};
