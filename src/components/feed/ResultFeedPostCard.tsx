import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const HASHTAG = '#GEMEINSAMEINTEAM';

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
  return `${seg('p1')} · ${seg('p2')} · ${seg('p3')}`;
}

/** Nur Darstellung: 0' / keine Minute → Gedankenstrich */
function formatScorerMinuteLabel(minuteLabel: string): string {
  const t = minuteLabel.trim();
  const m = /^(\d+)/.exec(t);
  if (m && m[1] === '0') return '—';
  return t || '—';
}

function LogoImg({ src }: { src: string }) {
  const [imgSrc, setImgSrc] = useState(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  useEffect(() => {
    setImgSrc(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  }, [src]);
  const box = 'h-[3.25rem] w-[3.25rem] sm:h-[4.25rem] sm:w-[4.25rem]';
  return (
    <img
      src={imgSrc}
      alt=""
      className={`${box} shrink-0 object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]`}
      onError={() => {
        if (imgSrc !== '/logos/placeholder-shield-a.png') setImgSrc('/logos/placeholder-shield-a.png');
      }}
    />
  );
}

function CaptionBody({ text }: { text: string }) {
  const nodes = useMemo(() => {
    if (!text.includes(HASHTAG)) {
      return { before: text, tag: null as string | null };
    }
    const i = text.lastIndexOf(HASHTAG);
    return {
      before: text.slice(0, i).replace(/\s+$/, ''),
      tag: HASHTAG,
    };
  }, [text]);

  if (!nodes.tag) {
    return <>{text}</>;
  }

  return (
    <>
      {nodes.before ? (
        <>
          {nodes.before}
          {'\n'}
        </>
      ) : null}
      <span className="font-extrabold tracking-wide text-white drop-shadow-[0_0_14px_rgba(248,113,113,0.55),0_1px_0_rgba(220,38,38,0.9)]">
        {nodes.tag}
      </span>
    </>
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
      className="w-full min-w-0 overflow-hidden rounded-3xl border border-red-600/35 bg-[#060606] shadow-xl pb-[max(1.5rem,calc(0.5rem+env(safe-area-inset-bottom,0px)))]"
      style={{
        boxShadow:
          'inset 0 0 70px rgba(120,20,20,0.1), 0 20px 44px rgba(0,0,0,0.58), 0 0 0 1px rgba(220,38,38,0.12), 0 0 36px -8px rgba(220,38,38,0.16)',
      }}
    >
      <header className="border-b border-white/[0.05] bg-black/35 px-3 pt-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <FeedCardHeaderBrand teamLabel={teamLabel} />
            <p className="mt-0.5 text-[10px] leading-snug text-white/45 sm:text-[11px]">{whenLabel}</p>
          </div>
          {staffCanDelete && onFeedPostDeleted ? (
            <div className="shrink-0 pt-0.5">
              <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
            </div>
          ) : null}
        </div>
        <div className="flex justify-center pb-3 pt-2">
          <span className="inline-flex items-center justify-center rounded-full border border-amber-400/50 bg-gradient-to-b from-amber-500/25 to-amber-950/60 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.15)] sm:px-5 sm:text-xs sm:tracking-[0.22em]">
            Endstand
          </span>
        </div>
      </header>

      <div
        className={`relative overflow-hidden bg-gradient-to-br px-3 pb-4 pt-1 sm:px-4 sm:pb-5 ${accent}`}
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(220,38,38,0.14),transparent)]" />

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-end gap-x-1 gap-y-1 sm:gap-x-3">
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">Heim</span>
            <LogoImg src={p.home_logo_url} />
            <p className="max-w-full break-words px-0.5 text-center text-[12px] font-bold leading-snug text-white [text-wrap:balance] sm:text-sm">
              {p.home_team_name}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-end pb-1">
            <p
              className="text-[2.85rem] font-black tabular-nums leading-[0.95] tracking-tight text-white sm:text-[3.35rem] sm:leading-none"
              style={{ textShadow: '0 4px 32px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.08)' }}
            >
              {p.home_score}
              <span className="mx-0.5 text-white/30 sm:mx-1">:</span>
              {p.away_score}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">Gast</span>
            <LogoImg src={p.away_logo_url} />
            <p className="max-w-full break-words px-0.5 text-center text-[12px] font-bold leading-snug text-white [text-wrap:balance] sm:text-sm">
              {p.away_team_name}
            </p>
          </div>
        </div>

        <div className="relative mt-4 space-y-0.5 text-center text-[11px] text-white/55 sm:text-[12px]">
          {p.match_type ? <p className="text-[11px] font-medium text-white/65">{p.match_type}</p> : null}
          <p>Anpfiff · {kickoffLabel}</p>
          {meetingLabel ? <p>Treffpunkt · {meetingLabel}</p> : null}
          <p className="line-clamp-2 break-words text-white/50">{p.location}</p>
        </div>

        {periodLine ? (
          <p className="relative mt-2 text-center text-[9px] font-medium tabular-nums tracking-wide text-white/32 sm:text-[10px]">
            <span className="mr-1 text-white/25">Drittel</span>
            {periodLine}
          </p>
        ) : null}

        {p.scorers.length > 0 ? (
          <div className="relative mt-3 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-1.5 sm:px-3 sm:py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">Torschützen</p>
            <ul className="mt-1 space-y-0.5">
              {p.scorers.map((s, i) => (
                <li
                  key={`${s.player_name}-${s.minute_label}-${i}`}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 text-[13px] leading-tight text-white/88 sm:text-sm"
                >
                  <span className="min-w-0 break-words [text-wrap:balance]">{s.player_name}</span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-white/45">
                    {formatScorerMinuteLabel(s.minute_label)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="relative mt-3 flex justify-center">
          <Link
            to={toGame}
            className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
          >
            Zum Spiel
          </Link>
        </div>
      </div>

      <div className="min-w-0 space-y-3 px-3 pt-6 sm:px-4 sm:pt-7">
        <p className="whitespace-pre-line px-0.5 text-[16px] font-medium leading-relaxed text-white/95 sm:text-[17px]">
          <CaptionBody text={post.caption} />
        </p>

        {shareHint ? <p className="text-center text-[13px] text-white/65">{shareHint}</p> : null}

        <div
          className="flex items-center justify-between gap-0.5 border-t border-white/[0.06] px-0.5 pb-[max(0.75rem,calc(0.35rem+env(safe-area-inset-bottom,0px)))] pt-3"
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
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/88"
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
