import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Heart, MapPin, Share2 } from 'lucide-react';
import type { LiveFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { FeedClubName } from './FeedClubName';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_HEADER_CLASS,
  FEED_TIMESTAMP_CLASS,
  FeedCaption,
} from './feedTypography';

type Props = {
  post: LiveFeedPostRow;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

const PLACEHOLDER = '/logos/placeholder-shield-a.png';

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

function LogoBlock({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const url = failed ? PLACEHOLDER : src || PLACEHOLDER;
  const isPlaceholder = !url || url === PLACEHOLDER;
  if (isPlaceholder) {
    return (
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/35 bg-black/50 shadow-[0_0_16px_rgba(220,38,38,0.25)]"
        aria-label={alt}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-red-200/85">Club</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-14 w-14 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
    />
  );
}

export const LiveFeedPostCard: React.FC<Props> = ({
  post,
  teamLabel,
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

  const locationLine = useMemo(() => {
    const parsed = splitCombinedLocation(p.location || null);
    return (formatFullLocation(parsed.place, parsed.address || '') || '').trim() || '—';
  }, [p.location]);

  const deepLink = p.deep_link?.startsWith('/') ? p.deep_link : `/app/live/${p.match_id}`;
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
    <article
      className="w-full min-w-0 overflow-hidden rounded-2xl border border-red-600/45 bg-[#080808] shadow-lg"
      style={{
        boxShadow:
          'inset 0 0 56px rgba(120,20,20,0.12), 0 14px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.14)',
      }}
    >
      <header className={`${FEED_POST_HEADER_CLASS} bg-black/30`}>
        <div className="min-w-0 flex-1">
          <FeedCardHeaderBrand teamLabel={teamLabel} />
          <p className={FEED_TIMESTAMP_CLASS}>{whenLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null}
          <span className="relative shrink-0">
            <span
              className="absolute inset-0 animate-ping rounded-full bg-red-500/40"
              aria-hidden
            />
            <span className="relative inline-flex items-center gap-1 rounded-full border border-red-500/50 bg-red-600/90 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-[0_0_14px_rgba(220,38,38,0.55)]">
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              Live
            </span>
          </span>
        </div>
      </header>

      <div className={`${FEED_POST_BODY_CLASS} space-y-3 pb-3`}>
        {post.caption?.trim() ? <FeedCaption text={post.caption} /> : null}

        <div
          className="relative overflow-hidden rounded-xl border border-red-500/35 px-2.5 py-3"
          style={{
            background:
              'linear-gradient(180deg, rgba(48,8,8,0.98) 0%, rgba(14,0,0,0.99) 50%, rgba(4,0,0,1) 100%)',
            boxShadow: 'inset 0 0 72px rgba(180,30,30,0.14), 0 0 28px rgba(220,38,38,0.12)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              background:
                'radial-gradient(ellipse 85% 55% at 50% 0%, rgba(248,113,113,0.55), transparent 72%)',
            }}
          />
          <div className="relative space-y-2.5">
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-red-300">
              Live jetzt
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex justify-center">
                  <LogoBlock src={p.home_logo_url} alt={`${p.home_team_name} Logo`} />
                </div>
                <FeedClubName fullName={p.home_team_name} variant="compact" className="w-full px-0.5" />
              </div>
              <span className="px-0.5 text-xl font-black uppercase tracking-[0.1em] text-white/80">VS</span>
              <div className="min-w-0 space-y-1">
                <div className="flex justify-center">
                  <LogoBlock src={p.away_logo_url} alt={`${p.away_team_name} Logo`} />
                </div>
                <FeedClubName fullName={p.away_team_name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/[0.06] bg-black/35 px-2 py-2 text-center">
              <div className="min-w-0">
                <dt className="flex items-center justify-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                  Anpfiff
                </dt>
                <dd className="mt-0.5 truncate text-[11px] font-semibold text-white/90">{kickoffLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center justify-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  Ort
                </dt>
                <dd className="mt-0.5 line-clamp-2 break-words text-[10px] font-semibold leading-snug text-white/82">
                  {locationLine}
                </dd>
              </div>
            </dl>
            <div className="flex justify-center pt-1">
              <Link
                to={deepLink}
                className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg border border-red-400/50 bg-gradient-to-b from-red-500 to-red-800 px-5 text-[13px] font-black uppercase tracking-wide text-white shadow-[0_0_22px_rgba(220,38,38,0.35)] transition hover:from-red-400 hover:to-red-700"
              >
                Zum Liveticker
              </Link>
            </div>
          </div>
        </div>

        {shareHint ? <p className="text-center text-[12px] text-white/60">{shareHint}</p> : null}

        <div className="flex items-center justify-between gap-1 border-t border-white/[0.06] pt-2.5">
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
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
            className="inline-flex min-h-[40px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white/68 transition-colors hover:bg-white/[0.06] hover:text-white/92"
            aria-label="Live-Spiel teilen"
          >
            <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} />
            Teilen
          </button>
        </div>
      </div>
    </article>
  );
};
