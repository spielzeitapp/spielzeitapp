import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ResultFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import { isValidLogoUrl } from '../../utils/logoResolver';
import { buildFeedMatchMetaLine, pickFeedAgeGroup } from '../../lib/feedClubNaming';
import { FeedClubName } from './FeedClubName';
import {
  FEED_CAPTION_FOOTER_CLASS,
  FeedCaption,
  FeedMatchMetaLine,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedStandardActions,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';

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

type ResultVisualState = 'win' | 'draw' | 'loss';

function resultPresentation(state: ResultVisualState) {
  if (state === 'win') {
    return {
      badge: 'SIEG',
      headline: '🏆 SIEG!',
      shellTint: 'from-emerald-950/[0.58] via-zinc-950/92 to-[#050508]',
      radial:
        'radial-gradient(ellipse 95% 55% at 50% 12%, rgba(251,191,36,0.38) 0%, transparent 54%), radial-gradient(ellipse 80% 45% at 50% 100%, rgba(0,0,0,0.55) 0%, transparent 55%)',
      articleShadow:
        'inset 0 0 60px rgba(120,80,10,0.14), 0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(251,191,36,0.18), 0 0 32px -4px rgba(251,191,36,0.22)',
      badgeClass:
        'border-amber-300/60 bg-gradient-to-b from-amber-400/45 via-amber-600/25 to-amber-950/75 text-amber-50 shadow-[0_0_32px_rgba(251,191,36,0.5),0_0_14px_rgba(245,158,11,0.28),inset_0_1px_0_rgba(255,255,255,0.22)]',
      headlineClass: 'text-[1.35rem] font-black uppercase tracking-[0.06em] text-amber-50 sm:text-2xl [text-shadow:0_0_28px_rgba(251,191,36,0.35)]',
      scorersBorder: 'border-amber-500/28',
      scorersGlow: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_22px_rgba(251,191,36,0.12)]',
      scorersTitle: 'text-amber-200/90',
    };
  }
  if (state === 'loss') {
    return {
      badge: 'KOPF HOCH',
      headline: '⚽ KOPF HOCH!',
      shellTint: 'from-zinc-900/85 via-[#0c0606] to-black',
      radial:
        'radial-gradient(ellipse 95% 55% at 50% 12%, rgba(220,38,38,0.2) 0%, transparent 54%), radial-gradient(ellipse 80% 45% at 50% 100%, rgba(0,0,0,0.58) 0%, transparent 55%)',
      articleShadow:
        'inset 0 0 60px rgba(80,10,10,0.14), 0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(220,38,38,0.14), 0 0 24px -6px rgba(185,28,28,0.18)',
      badgeClass:
        'border-red-500/35 bg-gradient-to-b from-red-950/55 via-zinc-950/80 to-black/90 text-red-100/95 shadow-[0_0_18px_rgba(185,28,28,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]',
      headlineClass: 'text-[1.2rem] font-black uppercase tracking-[0.05em] text-red-100/95 sm:text-[1.35rem] [text-shadow:0_0_18px_rgba(220,38,38,0.2)]',
      scorersBorder: 'border-red-500/22',
      scorersGlow: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_16px_rgba(185,28,28,0.08)]',
      scorersTitle: 'text-red-200/85',
    };
  }
  return {
    badge: 'UNENTSCHIEDEN',
    headline: '🤝 UNENTSCHIEDEN!',
    shellTint: 'from-slate-900/78 via-zinc-950/92 to-[#050508]',
    radial:
      'radial-gradient(ellipse 95% 55% at 50% 12%, rgba(255,255,255,0.12) 0%, transparent 54%), radial-gradient(ellipse 80% 45% at 50% 100%, rgba(0,0,0,0.55) 0%, transparent 55%)',
    articleShadow:
      'inset 0 0 60px rgba(40,40,48,0.12), 0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08), 0 0 22px -8px rgba(255,255,255,0.06)',
    badgeClass:
      'border-white/22 bg-gradient-to-b from-zinc-700/45 via-zinc-900/75 to-zinc-950/90 text-white/92 shadow-[0_0_20px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)]',
    headlineClass: 'text-[1.15rem] font-black uppercase tracking-[0.04em] text-white/95 sm:text-xl [text-shadow:0_0_16px_rgba(255,255,255,0.12)]',
    scorersBorder: 'border-white/14',
    scorersGlow: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_rgba(255,255,255,0.04)]',
    scorersTitle: 'text-white/72',
  };
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

  const presentation = resultPresentation(p.result_state);

  const onToggleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    try {
      sessionStorage.setItem(likeStorageKey(post.id), next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [liked, post.id]);

  const { backendRole, membershipRole } = useSession();
  const viewerIsStaff = canStaffManageTeamFeed(backendRole, membershipRole);

  const gameHref = useMemo(
    () =>
      resolveMatchGameHref({
        matchId: p.match_id,
        eventId: p.event_id,
        status: 'finished',
        canManage: viewerIsStaff,
      }),
    [p.match_id, p.event_id, viewerIsStaff],
  );

  const onShare = useCallback(async () => {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '');
    const path = gameHref.startsWith('/') ? gameHref : `/${gameHref}`;
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
  }, [post.caption, p.away_score, p.away_team_name, gameHref, p.home_score, p.home_team_name]);

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
    <FeedPostArticleShell
      className="border-red-600/30"
      style={{ boxShadow: presentation.articleShadow }}
      data-feed-result-card="v2"
    >
      {/* feed-result-comments-v1: reserved slot for threaded comments MVP (no UI yet) */}
      <div data-feed-comment-slot="reserved" hidden aria-hidden />
      <FeedPostHeader
        teamLabel={teamLabel}
        whenLabel={whenLabel}
        headerClassName="bg-black/35"
        actions={
          staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null
        }
      />
      <FeedPostTypeBadge>Ergebnis</FeedPostTypeBadge>
      <div className={`relative bg-gradient-to-b ${presentation.shellTint} px-2.5 pb-2 pt-2 sm:px-3`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{ background: presentation.radial }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-[28%] h-[42%] bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(255,255,255,0.06),transparent_70%)]" />

        <FeedMatchMetaLine line={matchMetaLine} className="relative text-center" />

        <div className="relative flex flex-col items-center gap-1 pb-0.5 pt-0.5">
          <span
            className={`inline-flex max-w-full items-center justify-center rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] sm:px-3 sm:text-[9px] sm:tracking-[0.18em] ${presentation.badgeClass}`}
            aria-label={presentation.badge}
          >
            <span className="truncate">{presentation.badge}</span>
          </span>
          <p className={`text-center leading-none ${presentation.headlineClass}`}>{presentation.headline}</p>
        </div>

        <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-0.5 gap-y-0 px-0 sm:gap-x-1">
          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/28">Heim</span>
            <LogoImg src={p.home_logo_url} />
            <FeedClubName fullName={p.home_team_name} variant="result" className="w-full px-0.5" />
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center px-0.5 sm:px-1">
            <p
              className="text-[2.85rem] font-black tabular-nums leading-none tracking-tighter text-white min-[390px]:text-[3.15rem] sm:text-[4rem] sm:tracking-tight"
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
              to={gameHref}
              className="inline-flex touch-manipulation text-[10px] font-semibold text-amber-200/90 underline decoration-amber-500/40 underline-offset-2 transition hover:text-amber-100"
            >
              Zum Spiel
            </Link>
          </p>
        </div>

        {filteredScorers.length > 0 ? (
          <div
            className={`relative mt-2.5 overflow-hidden rounded-xl border bg-gradient-to-br from-[rgba(22,22,26,0.88)] to-[rgba(48,10,16,0.18)] px-3.5 py-3 sm:px-4 sm:py-3.5 ${presentation.scorersBorder} ${presentation.scorersGlow}`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.16em] ${presentation.scorersTitle}`}
            >
              Torschützen
            </p>
            <ul className="mt-2 space-y-2">
              {filteredScorers.map((s, i) => {
                const minOk = isSensibleScorerMinute(s.minute_label);
                const minShown = showScorerMinutes && minOk ? s.minute_label.trim() : null;
                return (
                  <li
                    key={`${s.player_name}-${i}`}
                    className={`grid gap-x-2.5 border-b border-white/[0.06] pb-2 text-[13px] font-medium leading-snug text-white/94 last:border-0 last:pb-0 sm:text-[14px] ${showScorerMinutes ? 'grid-cols-[minmax(0,1fr)_2.25rem]' : 'grid-cols-1'}`}
                  >
                    <span className="min-w-0 break-words">{s.player_name.trim()}</span>
                    {showScorerMinutes ? (
                      <span className="shrink-0 text-right tabular-nums text-[12px] font-semibold text-white/55 sm:text-[13px]">
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

        <FeedStandardActions
          liked={liked}
          onToggleLike={onToggleLike}
          onShare={() => void onShare()}
          className="mt-1 border-t-0 pt-0"
        />
      </div>
    </FeedPostArticleShell>
  );
};
