import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import type { ResultFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import { isValidLogoUrl } from '../../utils/logoResolver';
import { buildFeedMatchMetaLine, pickFeedAgeGroup } from '../../lib/feedClubNaming';
import { FeedClubName } from './FeedClubName';
import {
  FEED_CAPTION_FOOTER_CLASS,
  FEED_TIMESTAMP_CLASS,
  FeedCaption,
  FeedMatchMetaLine,
} from './feedTypography';

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
    const pr = o[key];
    if (!pr || typeof pr !== 'object') return '-:-';
    const h = Math.max(0, Math.trunc(Number(pr.h) || 0));
    const a = Math.max(0, Math.trunc(Number(pr.a) || 0));
    return `${h}:${a}`;
  };
  const line = `${seg('p1')} · ${seg('p2')} · ${seg('p3')}`;
  if (line === '-:- · -:- · -:-') return null;
  return line;
}

function isSensibleScorerMinute(minuteLabel: string): boolean {
  const t = minuteLabel.trim();
  if (!t || t === '—') return false;
  const m = /^(\d+)/.exec(t);
  if (m && m[1] === '0') return false;
  return true;
}

function isRealScorerName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n !== '—' && n !== '–';
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
      className="h-[3.75rem] w-[3.75rem] shrink-0 object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)] sm:h-[4.5rem] sm:w-[4.5rem]"
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

  const filteredScorers = useMemo(
    () => p.scorers.filter((s) => isRealScorerName(s.player_name)),
    [p.scorers],
  );
  const showScorerMinutes = useMemo(
    () => filteredScorers.some((s) => isSensibleScorerMinute(s.minute_label)),
    [filteredScorers],
  );

  const winTint =
    p.result_state === 'win'
      ? 'from-emerald-950/[0.55] via-zinc-950/90 to-[#050508]'
      : p.result_state === 'loss'
        ? 'from-zinc-900/80 via-[#0a0808] to-black'
        : 'from-slate-900/75 via-zinc-950/92 to-[#050508]';

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

  const matchMetaLine = buildFeedMatchMetaLine(
    pickFeedAgeGroup(teamLabel, p.home_team_name, p.away_team_name),
    getMatchTypeLabel(p.match_type ?? undefined) || null,
  );
  const metaBits = [
    kickoffLabel !== '—' ? `Anpfiff ${kickoffLabel}` : null,
    meetingLabel ? `Treff ${meetingLabel}` : null,
  ].filter(Boolean);
  const locTrim = (p.location ?? '').trim();
  const metaLine = [...metaBits, locTrim || null].filter(Boolean).join(' · ');

  return (
    <article
      className="w-full min-w-0 overflow-hidden rounded-3xl border border-red-600/30 bg-[#050508] shadow-xl"
      style={{
        boxShadow:
          'inset 0 0 60px rgba(80,10,10,0.12), 0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(220,38,38,0.1), 0 0 28px -6px rgba(220,38,38,0.12)',
      }}
    >
      <div className={`relative bg-gradient-to-b ${winTint} px-2.5 pb-2 pt-2 sm:px-3`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 95% 55% at 50% 18%, rgba(220,38,38,0.22) 0%, transparent 52%), radial-gradient(ellipse 80% 45% at 50% 100%, rgba(0,0,0,0.55) 0%, transparent 55%)',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-[28%] h-[42%] bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(255,255,255,0.06),transparent_70%)]" />

        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <FeedCardHeaderBrand teamLabel={teamLabel} />
            <p className="mt-0.5 text-[9px] leading-tight text-white/38 sm:text-[10px]">{whenLabel}</p>
          </div>
          {staffCanDelete && onFeedPostDeleted ? (
            <div className="shrink-0">
              <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
            </div>
          ) : null}
        </div>

        <FeedMatchMetaLine line={matchMetaLine} className="relative text-center" />

        <div className="relative flex justify-center pb-1 pt-0.5">
          <span
            className="inline-flex items-center justify-center rounded-full border border-amber-300/55 bg-gradient-to-b from-amber-400/35 via-amber-600/20 to-amber-950/70 px-[0.65rem] py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-50 shadow-[0_0_28px_rgba(251,191,36,0.45),0_0_12px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] sm:px-4 sm:text-[11px] sm:tracking-[0.26em]"
            aria-label="Endstand"
          >
            Endstand
          </span>
        </div>

        <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-0.5 gap-y-0 px-0 sm:gap-x-1">
          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/28">Heim</span>
            <LogoImg src={p.home_logo_url} />
            <FeedClubName fullName={p.home_team_name} variant="result" className="w-full px-0.5" />
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center px-0.5 sm:px-1">
            <p
              className="text-[3.35rem] font-black tabular-nums leading-none tracking-tighter text-white sm:text-[4rem] sm:tracking-tight"
              style={{
                textShadow:
                  '0 0 40px rgba(0,0,0,0.75), 0 6px 28px rgba(0,0,0,0.55), 0 0 2px rgba(255,255,255,0.12)',
              }}
            >
              {p.home_score}
              <span className="mx-0.5 align-middle text-[0.55em] font-black text-white/28 sm:mx-1">:</span>
              {p.away_score}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/28">Gast</span>
            <LogoImg src={p.away_logo_url} />
            <p className="line-clamp-2 max-w-full break-words px-0.5 text-center text-[10px] font-bold leading-tight text-white/88 [text-wrap:balance] sm:text-[11px]">
              {p.away_team_name}
            </p>
          </div>
        </div>

        <div className="relative mt-1.5 space-y-0.5 text-center">
          {metaLine ? (
            <p className="line-clamp-2 px-1 text-[10px] leading-snug text-white/48 sm:text-[11px]">{metaLine}</p>
          ) : null}
          {periodLine ? (
            <p className="text-[8px] font-medium tabular-nums tracking-wide text-white/28 sm:text-[9px]">
              Drittel {periodLine}
            </p>
          ) : null}
          <p className="pt-0.5">
            <Link
              to={toGame}
              className="inline-flex touch-manipulation text-[10px] font-semibold text-amber-200/90 underline decoration-amber-500/40 underline-offset-2 transition hover:text-amber-100"
            >
              Zum Spiel
            </Link>
          </p>
        </div>

        {filteredScorers.length > 0 ? (
          <div className="relative mt-2.5 overflow-hidden rounded-xl border border-[rgba(220,38,38,0.22)] bg-gradient-to-br from-[rgba(25,25,28,0.72)] to-[rgba(80,12,20,0.14)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(220,38,38,0.08)] sm:px-3.5 sm:py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/42">Torschützen</p>
            <ul className="mt-1.5 space-y-1.5">
              {filteredScorers.map((s, i) => {
                const minOk = isSensibleScorerMinute(s.minute_label);
                const minShown = showScorerMinutes && minOk ? s.minute_label.trim() : null;
                return (
                  <li
                    key={`${s.player_name}-${i}`}
                    className={`grid gap-x-3 text-[12px] leading-snug text-white/92 sm:text-[13px] ${showScorerMinutes ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}
                  >
                    <span className="min-w-0 break-words [text-wrap:balance]">{s.player_name.trim()}</span>
                    {showScorerMinutes ? (
                      <span className="w-9 shrink-0 text-right tabular-nums text-[11px] text-white/45 sm:w-10 sm:text-xs">
                        {minShown ?? ''}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <div className={FEED_CAPTION_FOOTER_CLASS}>
        <FeedCaption text={post.caption} />

        {shareHint ? <p className="mt-2 text-center text-[12px] text-white/55">{shareHint}</p> : null}

        <div className="mt-3 flex items-center justify-between gap-0.5 px-0.5">
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ${
              liked ? 'text-red-400' : 'text-white/65 hover:bg-white/[0.05] hover:text-white/90'
            }`}
            aria-pressed={liked}
          >
            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} strokeWidth={2} />
            Gefällt mir
          </button>
          <Link
            to="/app/nachrichten"
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-white/52 transition-colors hover:bg-white/[0.04] hover:text-white/85"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            Kommentar
          </Link>
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-white/65 transition-colors hover:bg-white/[0.05] hover:text-white/90"
          >
            <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} />
            Teilen
          </button>
        </div>
      </div>
    </article>
  );
};
