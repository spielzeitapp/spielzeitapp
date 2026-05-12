import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Pause, Play, Share2 } from 'lucide-react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { shareFeedContent } from '../../lib/feedShare';

type Props = {
  post: TeamFeedPostDbRow;
  teamLabel: string;
};

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

export const VideoFeedPostCard: React.FC<Props> = ({ post, teamLabel }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [srcLoaded, setSrcLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const resolvedSrc = useFeedMediaSrc(post.media_url);
  const thumbSrc = useFeedMediaSrc(post.thumbnail_url);

  useEffect(() => {
    try {
      setLiked(sessionStorage.getItem(likeStorageKey(post.id)) === '1');
    } catch {
      setLiked(false);
    }
  }, [post.id]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.2);
        setInView(hit);
      },
      { root: null, threshold: [0, 0.2, 0.45] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (inView && !srcLoaded && resolvedSrc) {
      setSrcLoaded(true);
    }
  }, [inView, srcLoaded, resolvedSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !srcLoaded) return;
    if (!inView) {
      v.pause();
      setPlaying(false);
    }
  }, [inView, srcLoaded]);

  const syncPlaying = useCallback(() => {
    const v = videoRef.current;
    if (v) setPlaying(!v.paused);
  }, []);

  const onTogglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !resolvedSrc) return;
    v.muted = true;
    v.playsInline = true;
    if (v.paused) {
      void v.play().then(syncPlaying).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [resolvedSrc, syncPlaying]);

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
    const title = 'SpielzeitApp · Video';
    const text = post.caption?.trim() || 'Team-Video';
    const lower = (post.media_url ?? '').toLowerCase();
    const ext = lower.endsWith('.webm') ? 'webm' : lower.endsWith('.mov') ? 'mov' : 'mp4';
    const mimeType =
      ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    const outcome = await shareFeedContent({
      title,
      text,
      fetchUrl: resolvedSrc,
      fileName: `spielzeit-feed-${post.id.slice(0, 8)}.${ext}`,
      mimeType,
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
  const posterResolved = thumbSrc ?? undefined;

  return (
    <article
      ref={wrapRef}
      className="w-full overflow-hidden rounded-3xl border border-red-600/35 bg-[#060606] shadow-xl"
      style={{
        boxShadow:
          'inset 0 0 70px rgba(120,20,20,0.12), 0 20px 44px rgba(0,0,0,0.58), 0 0 0 1px rgba(220,38,38,0.12), 0 0 36px -8px rgba(220,38,38,0.18)',
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.05] bg-black/35 px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">
            SpielzeitApp
            <span className="font-normal text-white/40"> · </span>
            <span className="text-red-300/90">{teamLabel}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">{whenLabel}</p>
        </div>
        <span className="shrink-0 rounded-full border border-red-500/35 bg-red-950/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/95">
          Video
        </span>
      </header>

      <div className="space-y-3 px-2 pb-3 pt-3 sm:px-3">
        <div
          className="relative mx-auto w-full max-w-[min(100%,420px)] overflow-hidden rounded-2xl border border-red-900/30 bg-black"
          style={{ aspectRatio: '9 / 16' }}
        >
          {srcLoaded && resolvedSrc ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              src={resolvedSrc}
              poster={posterResolved}
              muted
              playsInline
              preload="metadata"
              controls={false}
              onPlay={syncPlaying}
              onPause={syncPlaying}
            />
          ) : (
            <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-gradient-to-b from-zinc-900 to-black px-4 text-center text-xs text-white/45">
              {!resolvedSrc && inView
                ? 'Medien-Link ungültig oder keine Berechtigung.'
                : inView
                  ? 'Video wird geladen…'
                  : 'Nach unten scrollen zum Laden'}
            </div>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!resolvedSrc || !srcLoaded}
            className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 disabled:opacity-35"
            aria-label={playing ? 'Pause' : 'Abspielen'}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
          </button>
        </div>

        <p className="px-1 text-sm leading-relaxed text-white/90">{post.caption}</p>

        {shareHint ? <p className="text-center text-xs text-white/55">{shareHint}</p> : null}

        <div
          className="flex items-center justify-between gap-0.5 border-t border-white/[0.06] px-0.5 pt-3"
          style={{ boxShadow: 'inset 0 1px 0 rgba(220,38,38,0.06)' }}
        >
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              liked ? 'text-red-400' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/88'
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
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/88"
          >
            <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} />
            Teilen
          </button>
        </div>
      </div>
    </article>
  );
};
