import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { shareFeedContent } from '../../lib/feedShare';
import { compactMatchdayCaption } from '../../lib/matchdayShareText';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { FeedPostCtaButton } from './FeedPostCtaButton';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedPostHeader,
  FeedPostActionsFooter,
  FeedStandardActions,
  FEED_STADIUM_ARTICLE_SHADOW,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { FeedPostEditButton } from './FeedPostEditButton';
import { matchdayPosterDomToPngBlob } from '../../lib/matchdayPosterExport';

type Props = {
  post: TeamFeedPostDbRow;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
  onFeedPostUpdated?: () => void;
};

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

export const ImageFeedPostCard: React.FC<Props> = ({ post, teamLabel, seasonLabel, staffCanDelete, onFeedPostDeleted, onFeedPostUpdated }) => {
  const [liked, setLiked] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const brandedImageRef = useRef<HTMLDivElement>(null);
  const resolvedSrc = useFeedMediaSrc(post.media_url);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setImageAspectRatio(null);
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
    const text = compactMatchdayCaption(post.caption ?? '') || 'Team-Foto';
    const lower = (post.media_url ?? '').toLowerCase();
    const ext = lower.endsWith('.png') ? 'png' : lower.endsWith('.webp') ? 'webp' : 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const brandedBlob = post.id.startsWith('df-') && brandedImageRef.current
      ? await matchdayPosterDomToPngBlob(brandedImageRef.current)
      : null;
    const outcome = await shareFeedContent({
      title,
      text,
      fetchUrl: brandedBlob ? null : resolvedSrc,
      file: brandedBlob ? new File([brandedBlob], `spielzeit-feed-${post.id.slice(0, 8)}.png`, { type: 'image/png' }) : null,
      fileName: brandedBlob ? `spielzeit-feed-${post.id.slice(0, 8)}.png` : `spielzeit-feed-${post.id.slice(0, 8)}.${ext}`,
      mimeType: brandedBlob ? 'image/png' : mime,
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
      className=""
      style={{ boxShadow: FEED_STADIUM_ARTICLE_SHADOW }}
    >
      <FeedPostHeader
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        whenLabel={whenLabel}
        headerClassName="bg-black/25"
        actions={staffCanDelete && onFeedPostDeleted ? (
          <div className="flex items-center gap-2">
            {['event_poster_manual', 'trainer_image', 'manual_image'].includes(post.post_kind) ? (
              <FeedPostEditButton post={post} onUpdated={onFeedPostUpdated ?? onFeedPostDeleted} />
            ) : null}
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          </div>
        ) : null}
      />
      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-2`}>
        <div
          ref={brandedImageRef}
          className="sz-club-feed-media-frame relative max-h-[min(78vh,720px)] w-full overflow-hidden rounded-none border-y bg-black sm:rounded-2xl sm:border"
          style={{ aspectRatio: imageAspectRatio ?? 4 / 5 }}
        >
          {resolvedSrc && !imageFailed ? (
            <img
              src={resolvedSrc}
              data-whatsapp-status-image
              alt=""
              className={`h-full w-full object-contain transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                  setImageAspectRatio(image.naturalWidth / image.naturalHeight);
                }
                setImageLoaded(true);
              }}
              onError={() => setImageFailed(true)}
            />
          ) : null}
          {post.id.startsWith('df-') && imageLoaded ? (
            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-xl border border-white/20 bg-black/80 px-2.5 py-1.5 text-white shadow-xl backdrop-blur-sm" aria-label="SpielzeitApp Demo">
              <img src="/logos/nsg-goelsental.png" alt="" className="h-9 w-9 object-contain" />
              <span className="text-sm font-extrabold tracking-tight">Spielzeit<span className="text-red-400">App</span></span>
            </div>
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
          <FeedStandardActions liked={liked} onToggleLike={onToggleLike} onShare={() => void onShare()} inFooter whatsAppStatus />
        </FeedPostActionsFooter>
      </div>
    </FeedPostArticleShell>
  );
};
