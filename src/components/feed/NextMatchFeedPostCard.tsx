import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Heart, MapPin, Share2 } from 'lucide-react';
import type { NextMatchFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { getClubLogo } from '../../lib/teamLogos';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { FeedClubName } from './FeedClubName';
import {
  FEED_ACTIONS_ROW_CLASS,
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedPostHeader,
  FeedPostTypeBadge,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';

type Props = {
  post: NextMatchFeedPostRow;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

const PLACEHOLDER = '/logos/placeholder-shield-a.png';

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

function formatKickoffDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

function formatKickoffTime(iso: string): string {
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
        className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-black/45 shadow-[0_0_12px_rgba(0,0,0,0.35)]"
        aria-label={alt}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-red-200/80">Club</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
    />
  );
}

export const NextMatchFeedPostCard: React.FC<Props> = ({
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

  const homeLogoUrl = useMemo(() => {
    if (p.home_logo_url) return p.home_logo_url;
    if (p.is_home) return getClubLogo(p.our_team_name);
    return getClubLogo(p.display_home_name, { logoUrl: p.opponent_logo_url });
  }, [p]);

  const awayLogoUrl = useMemo(() => {
    if (p.away_logo_url) return p.away_logo_url;
    if (p.is_home) return getClubLogo(p.display_away_name, { logoUrl: p.opponent_logo_url });
    return getClubLogo(p.our_team_name);
  }, [p]);

  const locationLine = useMemo(() => {
    const parsed = splitCombinedLocation(p.location || null);
    const place = parsed.place;
    const addr = parsed.address || (p.address ?? '').trim();
    return (formatFullLocation(place, addr) || '').trim() || '—';
  }, [p.location, p.address]);

  const gameHref = resolveMatchGameHref({
    matchId: p.match_id,
    eventId: p.event_id,
    status: 'upcoming',
  });
  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);
  const dateLabel = formatKickoffDate(p.kickoff_iso);
  const kickoffLabel = formatKickoffTime(p.kickoff_iso);

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
    const path = gameHref.startsWith('/') ? gameHref : `/${gameHref}`;
    const url = `${window.location.origin}${base}${path}`;
    const outcome = await shareFeedContent({
      title: 'SpielzeitApp · Nächstes Spiel',
      text: `${post.caption}\n${url}`,
    });
    if (outcome === 'aborted') return;
    if (outcome === 'shared') setShareHint('Geteilt.');
    else if (outcome === 'copied') setShareHint('Text kopiert.');
    else setShareHint('Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2400);
  }, [gameHref, post.caption]);

  return (
    <FeedPostArticleShell
      style={{
        boxShadow:
          'inset 0 0 48px rgba(80,10,10,0.08), 0 12px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(220,38,38,0.08)',
      }}
    >
      <FeedPostHeader
        teamLabel={teamLabel}
        whenLabel={whenLabel}
        headerClassName="bg-black/25"
        actions={
          staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null
        }
      />
      <FeedPostTypeBadge>Ankündigung</FeedPostTypeBadge>

      <div className={`${FEED_POST_BODY_CLASS} pb-3`}>
        <div
          className="relative overflow-hidden rounded-xl border border-red-600/28 px-2.5 py-2.5"
          style={{
            background:
              'linear-gradient(180deg, rgba(32,6,6,0.96) 0%, rgba(12,0,0,0.98) 55%, rgba(6,0,0,0.99) 100%)',
            boxShadow: 'inset 0 0 64px rgba(120,20,20,0.1), 0 0 0 1px rgba(220,38,38,0.1)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.09]"
            style={{
              background:
                'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(248,113,113,0.45), transparent 70%)',
            }}
          />
          <div className="relative space-y-2">
            <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-red-300/90">
              Nächstes Spiel
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
              <div className="min-w-0 space-y-1">
                <div className="flex justify-center">
                  <LogoBlock src={homeLogoUrl} alt={`${p.display_home_name} Logo`} />
                </div>
                <FeedClubName fullName={p.display_home_name} variant="compact" className="w-full px-0.5" />
              </div>
              <span className="px-0.5 text-lg font-black uppercase tracking-[0.08em] text-white/75">VS</span>
              <div className="min-w-0 space-y-1">
                <div className="flex justify-center">
                  <LogoBlock src={awayLogoUrl} alt={`${p.display_away_name} Logo`} />
                </div>
                <FeedClubName fullName={p.display_away_name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-black/30 px-1.5 py-1.5 text-center">
              <div className="min-w-0">
                <dt className="flex items-center justify-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                  Datum
                </dt>
                <dd className="mt-0.5 truncate text-[11px] font-semibold text-white/90">{dateLabel}</dd>
              </div>
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
            <div className="flex justify-center pt-0.5">
              <Link
                to={gameHref}
                className="inline-flex min-h-[40px] touch-manipulation items-center justify-center rounded-lg border border-red-500/40 bg-red-600/85 px-4 text-[12px] font-bold text-white shadow-md transition hover:bg-red-500"
              >
                Zum Spiel
              </Link>
            </div>
          </div>
        </div>

        {post.caption?.trim() ? (
          <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}>
            <FeedCaption text={post.caption} />
          </div>
        ) : null}

        {shareHint ? <p className="mt-2 text-center text-[12px] text-white/60">{shareHint}</p> : null}

        <div className={`${FEED_ACTIONS_ROW_CLASS} mx-0 justify-center gap-6 border-t-0 pt-1`}>
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold transition ${liked ? 'text-red-300' : 'text-white/55 hover:text-white/80'}`}
            aria-pressed={liked}
          >
            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} aria-hidden />
            Gefällt mir
          </button>
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/55 transition hover:text-white/80"
            aria-label="Spielankündigung teilen"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Teilen
          </button>
        </div>
      </div>
    </FeedPostArticleShell>
  );
};
