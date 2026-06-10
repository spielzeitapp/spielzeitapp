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
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';

type Props = {
  post: NextMatchFeedPostRow;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

const PLACEHOLDER = '/logos/placeholder-shield-a.png';

/** Stadion-Backdrop wie Welcome-Screen / Matchday-Poster / Live-Screen. */
const stadiumBgUrl = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

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
        className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-black/45 shadow-[0_0_16px_rgba(0,0,0,0.4)] sm:h-[4.5rem] sm:w-[4.5rem]"
        aria-label={alt}
      >
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-red-200/80">Club</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-16 w-16 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)] sm:h-[4.5rem] sm:w-[4.5rem]"
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

  const { backendRole, membershipRole } = useSession();
  const viewerIsStaff = canStaffManageTeamFeed(backendRole, membershipRole);
  const gameHref = resolveMatchGameHref({
    matchId: p.match_id,
    eventId: p.event_id,
    status: 'upcoming',
    canManage: viewerIsStaff,
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
      className="!border-[rgba(255,71,71,0.15)]"
      style={{
        boxShadow:
          'inset 0 0 48px rgba(80,10,10,0.1), 0 14px 32px rgba(0,0,0,0.5), 0 0 36px rgba(227,29,47,0.13)',
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
        <div className="relative overflow-hidden rounded-[20px] border border-[rgba(255,71,71,0.15)] px-3 pb-4 pt-4 shadow-[0_0_30px_rgba(227,29,47,0.1),inset_0_1px_0_rgba(255,255,255,0.04)]">
          {/* Stadion-Backdrop: Crowd-Silhouetten, Flutlicht oben, roter Nebel unten */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <img
              src={stadiumBgUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover object-[center_30%] opacity-[0.22] brightness-[0.5] saturate-[0.72]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,8,9,0.84)_0%,rgba(9,4,5,0.92)_52%,rgba(5,2,3,0.97)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-10%,rgba(255,240,220,0.13)_0%,transparent_62%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_50%_115%,rgba(227,29,47,0.15)_0%,transparent_62%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_22%)]" />
          </div>
          <div className="relative space-y-3">
            <p className="text-center text-[17px] font-black uppercase leading-none tracking-[0.2em] text-white drop-shadow-[0_0_14px_rgba(255,71,71,0.35)] sm:text-[19px] sm:tracking-[0.24em]">
              Nächstes Spiel
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 pt-0.5">
              <div className="min-w-0 space-y-1.5">
                <div className="flex justify-center">
                  <LogoBlock src={homeLogoUrl} alt={`${p.display_home_name} Logo`} />
                </div>
                <FeedClubName fullName={p.display_home_name} variant="compact" className="w-full px-0.5" />
              </div>
              <span className="px-1 text-2xl font-black italic uppercase leading-none tracking-[0.04em] text-red-400/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-[1.7rem]">
                VS
              </span>
              <div className="min-w-0 space-y-1.5">
                <div className="flex justify-center">
                  <LogoBlock src={awayLogoUrl} alt={`${p.display_away_name} Logo`} />
                </div>
                <FeedClubName fullName={p.display_away_name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-1.5 text-center">
              <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.045] px-1 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <dt className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                  Datum
                </dt>
                <dd className="mt-1 truncate text-[12px] font-semibold text-white">{dateLabel}</dd>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.045] px-1 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <dt className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                  Anpfiff
                </dt>
                <dd className="mt-1 truncate text-[12px] font-semibold text-white">{kickoffLabel}</dd>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.045] px-1 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                <dt className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-red-200/85">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  Ort
                </dt>
                <dd
                  className="mt-1 line-clamp-3 break-words text-[10.5px] font-semibold leading-snug text-white/90"
                  title={locationLine}
                >
                  {locationLine}
                </dd>
              </div>
            </dl>
            <div className="flex justify-center pt-1">
              <Link
                to={gameHref}
                className="inline-flex min-h-[48px] w-full max-w-[22rem] touch-manipulation items-center justify-center rounded-[22px] bg-gradient-to-b from-[#FF4747] to-[#E31D2F] px-6 text-[14px] font-bold tracking-[0.02em] text-white shadow-[0_10px_26px_rgba(227,29,47,0.38),inset_0_1px_0_rgba(255,255,255,0.28),0_2px_8px_rgba(0,0,0,0.4)] transition hover:brightness-110 active:scale-[0.98]"
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
