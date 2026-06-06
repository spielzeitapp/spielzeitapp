import React, { useCallback, useEffect, useState } from 'react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedStandardActions,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';

type Props = {
  post: TeamFeedPostDbRow;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

export const ImageFeedPostCard: React.FC<Props> = ({ post, teamLabel, staffCanDelete, onFeedPostDeleted }) => {
  const [liked, setLiked] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const resolvedSrc = useFeedMediaSrc(post.media_url);

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
      className="border-red-600/35"
      style={{
        boxShadow:
          'inset 0 0 70px rgba(120,20,20,0.1), 0 20px 44px rgba(0,0,0,0.58), 0 0 0 1px rgba(220,38,38,0.12), 0 0 36px -8px rgba(220,38,38,0.16)',
      }}
    >
      <FeedPostHeader
        teamLabel={teamLabel}
        whenLabel={whenLabel}
        actions={
          staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null
        }
      />
      <FeedPostTypeBadge>Foto</FeedPostTypeBadge>

      <div className={FEED_POST_BODY_CLASS}>
        {resolvedSrc ? (
          <div className="overflow-hidden rounded-2xl border border-red-900/25 bg-black">
            <img
              src={resolvedSrc}
              alt=""
              className="max-h-[min(78vh,720px)] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-8 text-center text-xs text-white/55">
            Bild konnte nicht geladen werden.
          </div>
        )}

        {post.caption?.trim() ? (
          <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}>
            <FeedCaption text={post.caption} />
          </div>
        ) : null}

        {shareHint ? <p className="mt-2 text-center text-[12px] text-white/65">{shareHint}</p> : null}

        <FeedStandardActions liked={liked} onToggleLike={onToggleLike} onShare={() => void onShare()} />
      </div>
    </FeedPostArticleShell>
  );
};
