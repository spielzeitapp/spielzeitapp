import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Pause, Play, Share2 } from 'lucide-react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';

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
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.25);
        setInView(hit);
      },
      { root: null, threshold: [0, 0.25, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (inView && !srcLoaded && post.media_url) {
      setSrcLoaded(true);
    }
  }, [inView, srcLoaded, post.media_url]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !srcLoaded) return;
    if (!inView) {
      v.pause();
      setPlaying(false);
      return;
    }
    v.muted = true;
    v.playsInline = true;
    void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [inView, srcLoaded]);

  const onTogglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

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
    const url = post.media_url ?? '';
    const text = `${post.caption}\n${url}`.trim();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'SpielzeitApp · Video', text });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareHint('Link kopiert.');
      window.setTimeout(() => setShareHint(null), 2200);
    } catch {
      setShareHint('Teilen nicht möglich.');
      window.setTimeout(() => setShareHint(null), 2200);
    }
  }, [post.caption, post.media_url]);

  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);

  return (
    <article
      ref={wrapRef}
      className="w-full overflow-hidden rounded-3xl border border-red-950/45 bg-[#070707] shadow-xl"
      style={{
        boxShadow:
          'inset 0 0 60px rgba(80,10,10,0.1), 0 18px 36px rgba(0,0,0,0.55), 0 0 0 1px rgba(220,38,38,0.08)',
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.05] bg-black/30 px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">
            SpielzeitApp
            <span className="font-normal text-white/40"> · </span>
            <span className="text-red-300/90">{teamLabel}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">{whenLabel}</p>
        </div>
        <span className="shrink-0 rounded-full border border-red-500/30 bg-red-950/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/95">
          Video
        </span>
      </header>

      <div className="space-y-3 px-2 pb-3 pt-3 sm:px-3">
        <p className="px-1 text-sm leading-relaxed text-white/90">{post.caption}</p>

        <div
          className="relative mx-auto w-full max-w-[min(100%,420px)] overflow-hidden rounded-2xl border border-white/[0.06] bg-black"
          style={{ aspectRatio: '9 / 16' }}
        >
          {srcLoaded && post.media_url ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              src={post.media_url}
              poster={post.thumbnail_url ?? undefined}
              muted
              playsInline
              loop
              preload="metadata"
              controls={false}
            />
          ) : (
            <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-xs text-white/40">
              {inView ? 'Video wird geladen…' : 'Scroll ins Bild — Video lädt dann'}
            </div>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/70"
            aria-label={playing ? 'Pause' : 'Abspielen'}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
          </button>
        </div>

        {shareHint ? <p className="text-center text-xs text-white/55">{shareHint}</p> : null}

        <div
          className="flex items-center justify-between gap-1 border-t border-white/[0.06] px-1 pt-3"
          style={{ boxShadow: 'inset 0 1px 0 rgba(220,38,38,0.05)' }}
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
