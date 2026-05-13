import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import type { ResultFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import { isValidLogoUrl } from '../../utils/logoResolver';

type Props = {
  post: ResultFeedPostRow;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

function formatPeriodScoresBrief(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, { h?: unknown; a?: unknown } | undefined>;
  const seg = (key: string) => {
    const p = o[key];
    if (!p || typeof p !== 'object') return '-:-';
    const h = Math.max(0, Math.trunc(Number(p.h) || 0));
    const a = Math.max(0, Math.trunc(Number(p.a) || 0));
    return `${h}:${a}`;
  };
  return `(${seg('p1')} | ${seg('p2')} | ${seg('p3')})`;
}

function LogoImg({ src }: { src: string }) {
  const [imgSrc, setImgSrc] = useState(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  useEffect(() => {
    setImgSrc(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  }, [src]);
  return (
    <img
      src={imgSrc}
      alt=""
      className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
      onError={() => {
        if (imgSrc !== '/logos/placeholder-shield-a.png') setImgSrc('/logos/placeholder-shield-a.png');
      }}
    />
  );
}

export const ResultFeedPostCard: React.FC<Props> = ({
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

  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);
  const kickoffLabel = p.starts_at ? formatDateTimeMediumDeVienna(p.starts_at) : '—';
  const meetingLabel = p.meeting_at ? formatMeetupTimeOnlyDe(p.meeting_at) : null;
  const periodLine = formatPeriodScoresBrief(p.period_scores);

  const accent =
    p.result_state === 'win'
      ? 'from-emerald-950/90 via-zinc-950/95 to-black'
      : p.result_state === 'loss'
        ? 'from-zinc-900/95 via-zinc-950/95 to-black'
        : 'from-slate-900/95 via-zinc-950/95 to-black';

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
    const path = p.deep_link.startsWith('/') ? p.deep_link : `/${p.deep_link}`;
    const url = `${window.location.origin}${base}${path}`;
    const title = 'SpielzeitApp · Ergebnis';
    const text = `${post.caption}\n${p.home_team_name} ${p.home_score}:${p.away_score} ${p.away_team_name}`;
    const outcome = await shareFeedContent({
      title,
      text: `${text}\n${url}`,
    });
    if (outcome === 'aborted') return;
    if (outcome === 'shared') setShareHint('Geteilt.');
    else if (outcome === 'copied') setShareHint('Text kopiert.');
    else setShareHint('Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2400);
  }, [post.caption, p.away_score, p.away_team_name, p.deep_link, p.home_score, p.home_team_name]);

  const toGame = p.deep_link.startsWith('/') ? p.deep_link : `/${p.deep_link}`;

  return (
    <article
      className="w-full min-w-0 overflow-hidden rounded-3xl border border-red-600/35 bg-[#060606] shadow-xl"
      style={{
        boxShadow:
          'inset 0 0 70px rgba(120,20,20,0.1), 0 20px 44px rgba(0,0,0,0.58), 0 0 0 1px rgba(220,38,38,0.12), 0 0 36px -8px rgba(220,38,38,0.16)',
      }}
    >
      <header className="flex items-start justify-between gap-2 border-b border-white/[0.05] bg-black/35 px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <FeedCardHeaderBrand teamLabel={teamLabel} />
          <p className="mt-1 text-xs text-white/65">{whenLabel}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null}
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100/95">
            Endstand
          </span>
        </div>
      </header>

      <div
        className={`relative overflow-hidden bg-gradient-to-br px-3 py-4 sm:px-4 ${accent}`}
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_0%,rgba(220,38,38,0.12),transparent)]" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2">
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <LogoImg src={p.home_logo_url} />
            <p className="max-w-full px-0.5 text-[11px] font-semibold leading-tight text-white/90 sm:text-xs">
              {p.home_team_name}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center px-0.5">
            <p
              className="text-[2.35rem] font-black tabular-nums leading-none tracking-tight text-white sm:text-[2.75rem]"
              style={{ textShadow: '0 2px 24px rgba(0,0,0,0.5)' }}
            >
              {p.home_score}
              <span className="mx-1 text-white/35">:</span>
              {p.away_score}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <LogoImg src={p.away_logo_url} />
            <p className="max-w-full px-0.5 text-[11px] font-semibold leading-tight text-white/90 sm:text-xs">
              {p.away_team_name}
            </p>
          </div>
        </div>

        <div className="relative mt-3 space-y-1 text-center text-[11px] text-white/60 sm:text-xs">
          {p.match_type ? <p className="font-medium text-white/75">{p.match_type}</p> : null}
          <p>Anpfiff · {kickoffLabel}</p>
          {meetingLabel ? <p>Treffpunkt · {meetingLabel}</p> : null}
          <p className="line-clamp-2 break-words">{p.location}</p>
          {periodLine ? <p className="font-mono text-[10px] text-white/45">{periodLine}</p> : null}
        </div>

        {p.scorers.length > 0 ? (
          <div className="relative mt-3 rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Torschützen</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-white/85">
              {p.scorers.map((s, i) => (
                <li key={`${s.player_name}-${s.minute_label}-${i}`} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{s.player_name}</span>
                  <span className="shrink-0 tabular-nums text-white/55">{s.minute_label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="relative mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300/90">
          #GEMEINSAMEINTEAM
        </p>

        <div className="relative mt-3 flex flex-wrap justify-center gap-2">
          <Link
            to={toGame}
            className="inline-flex min-h-10 touch-manipulation items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] px-4 text-xs font-semibold text-white transition hover:bg-white/[0.11]"
          >
            Zum Spiel
          </Link>
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex min-h-10 touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-red-500/35 bg-red-950/40 px-4 text-xs font-semibold text-white/90 transition hover:bg-red-950/55"
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
            Teilen
          </button>
        </div>
      </div>

      <div className="min-w-0 space-y-3 px-3 pb-3 pt-3 sm:px-4">
        <p className="whitespace-pre-line px-0.5 text-[15px] font-medium leading-relaxed text-white/95 sm:text-base">
          {post.caption}
        </p>

        {shareHint ? <p className="text-center text-[13px] text-white/65">{shareHint}</p> : null}

        <div
          className="flex items-center justify-between gap-0.5 border-t border-white/[0.06] px-0.5 pt-3"
          style={{ boxShadow: 'inset 0 1px 0 rgba(220,38,38,0.06)' }}
        >
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
    </article>
  );
};
