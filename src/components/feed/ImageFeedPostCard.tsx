import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import {
  FEED_ACTIONS_ROW_CLASS,
  FEED_POST_BODY_CLASS,
  FEED_POST_HEADER_CLASS,
  FEED_TIMESTAMP_CLASS,
  FeedCaption,
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
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.05] bg-black/35 px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <FeedCardHeaderBrand teamLabel={teamLabel} />
          <p className="mt-1 text-xs text-white/65">{whenLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null}
          <span className="shrink-0 rounded-full border border-red-500/35 bg-red-950/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/95">
            Foto
          </span>
        </div>
      </header>

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

        {post.caption?.trim() ? <FeedCaption text={post.caption} /> : null}

        {shareHint ? <p className="text-center text-[13px] text-white/65">{shareHint}</p> : null}

        <div className={FEED_ACTIONS_ROW_CLASS} style={{ boxShadow: 'inset 0 1px 0 rgba(220,38,38,0.06)' }}>
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ${
              liked ? 'text-red-400' : 'text-white/68 hover:bg-white/[0.06] hover:text-white/92'
            }`}
            aria-pressed={liked}
          >
            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} strokeWidth={2} />
            Gefällt mir
          </button>
          <Link
            to="/app/nachrichten"
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/88"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            Kommentar
          </Link>
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-white/68 transition-colors hover:bg-white/[0.06] hover:text-white/92"
          >
            <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} />
            Teilen
          </button>
        </div>
      </div>
    </FeedPostArticleShell>
  );
};
