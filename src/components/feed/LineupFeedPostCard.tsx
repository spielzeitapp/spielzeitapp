import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Heart, Share2 } from 'lucide-react';
import type { LineupFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_HEADER_CLASS,
  FEED_TIMESTAMP_CLASS,
  FeedCaption,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';

type Props = {
  post: LineupFeedPostRow;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

const MAX_DISPLAY_PLAYERS = 7;

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

export const LineupFeedPostCard: React.FC<Props> = ({
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

  const displayPlayers = useMemo(
    () => p.lineup_players.slice(0, MAX_DISPLAY_PLAYERS),
    [p.lineup_players],
  );

  const deepLink = useMemo(() => {
    if (p.deep_link?.startsWith('/')) return p.deep_link;
    if (p.match_id) return `/app/match/${encodeURIComponent(p.match_id)}`;
    return `/app/events/${p.event_id}`;
  }, [p.deep_link, p.event_id, p.match_id]);

  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);

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
      title: 'SpielzeitApp · Startaufstellung',
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
      className="border-red-950/50"
      style={{
        boxShadow:
          'inset 0 0 52px rgba(80,12,12,0.1), 0 14px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.12)',
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
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-950/70 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-100 shadow-[0_0_14px_rgba(220,38,38,0.28)]">
            <ClipboardList className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
            Startaufstellung
          </span>
        </div>
      </header>

      <div className={`${FEED_POST_BODY_CLASS} space-y-3 pb-3`}>
        {post.caption?.trim() ? <FeedCaption text={post.caption} /> : null}

        <div
          className="relative overflow-hidden rounded-xl border border-red-500/30 px-3 py-3.5"
          style={{
            background:
              'linear-gradient(180deg, rgba(28,10,12,0.98) 0%, rgba(10,6,8,0.99) 55%, rgba(4,2,4,1) 100%)',
            boxShadow: 'inset 0 0 64px rgba(140,24,24,0.1), 0 0 22px rgba(220,38,38,0.08)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.1]"
            style={{
              background:
                'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(248,113,113,0.45), transparent 70%)',
            }}
            aria-hidden
          />
          <div className="relative space-y-3">
            <p className="text-center text-[12px] font-black uppercase tracking-[0.2em] text-red-200/95">
              STARTAUFSTELLUNG
            </p>

            {p.formation ? (
              <p className="text-center text-[13px] font-bold tracking-wide text-white/88">{p.formation}</p>
            ) : null}

            <div className="rounded-lg border border-white/[0.07] bg-black/40 px-3 py-2.5">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-200/80">Startelf</p>
              <ul className="space-y-1 text-[13px] font-semibold leading-snug text-white/90">
                {displayPlayers.map((pl) => (
                  <li key={pl.player_id} className="flex gap-1.5">
                    <span className="text-red-400/90" aria-hidden>
                      •
                    </span>
                    <span>{pl.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center pt-0.5">
              <Link
                to={deepLink}
                className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg border border-red-400/45 bg-gradient-to-b from-red-600/90 to-red-900 px-5 text-[13px] font-black uppercase tracking-wide text-white shadow-[0_0_20px_rgba(220,38,38,0.28)] transition hover:from-red-500 hover:to-red-800"
              >
                Zum Spiel
              </Link>
            </div>
          </div>
        </div>

        {shareHint ? <p className="text-center text-[12px] text-white/60">{shareHint}</p> : null}

        <div className="flex items-center justify-center gap-6 border-t border-white/[0.06] pt-2">
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold transition ${liked ? 'text-red-300' : 'text-white/55 hover:text-white/80'}`}
            aria-pressed={liked}
          >
            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} aria-hidden />
            {liked ? 'Gefällt mir' : 'Gefällt mir'}
          </button>
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/55 transition hover:text-white/80"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Teilen
          </button>
        </div>
      </div>
    </FeedPostArticleShell>
  );
};
