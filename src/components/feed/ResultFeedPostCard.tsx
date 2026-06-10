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
  FEED_POST_BODY_CLASS,
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

/** Stadion-Backdrop wie Welcome-Screen / Spieltag-Poster. */
const stadiumBgUrl = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

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

const BASE_ARTICLE_SHADOW =
  'inset 0 0 48px rgba(80,10,10,0.1), 0 14px 32px rgba(0,0,0,0.5), 0 0 36px rgba(227,29,47,0.13)';

const BASE_SCORE_SHADOW =
  '0 0 44px rgba(0,0,0,0.8), 0 6px 28px rgba(0,0,0,0.6), 0 0 2px rgba(255,255,255,0.1)';

function resultPresentation(state: ResultVisualState) {
  if (state === 'win') {
    return {
      status: 'SIEG!',
      statusClass:
        'text-amber-300 [text-shadow:0_2px_10px_rgba(0,0,0,0.75),0_0_24px_rgba(251,191,36,0.45)]',
      accentRadial:
        'radial-gradient(ellipse 85% 55% at 50% 0%, rgba(251,191,36,0.16) 0%, transparent 60%)',
      articleShadow: `${BASE_ARTICLE_SHADOW}, 0 0 30px -6px rgba(251,191,36,0.22)`,
      scoreShadow:
        '0 0 44px rgba(0,0,0,0.8), 0 6px 28px rgba(0,0,0,0.6), 0 0 28px rgba(251,191,36,0.25)',
    };
  }
  if (state === 'loss') {
    return {
      status: 'SPIEL BEENDET',
      statusClass:
        'text-red-200/90 [text-shadow:0_2px_10px_rgba(0,0,0,0.75),0_0_18px_rgba(220,38,38,0.3)]',
      accentRadial: null,
      articleShadow: BASE_ARTICLE_SHADOW,
      scoreShadow: BASE_SCORE_SHADOW,
    };
  }
  return {
    status: 'PUNKTETEILUNG',
    statusClass:
      'text-white/92 [text-shadow:0_2px_10px_rgba(0,0,0,0.75),0_0_18px_rgba(255,255,255,0.2)]',
    accentRadial: null,
    articleShadow: BASE_ARTICLE_SHADOW,
    scoreShadow: BASE_SCORE_SHADOW,
  };
}

function LogoBlock({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const valid = !failed && isValidLogoUrl(src);
  if (!valid) {
    return (
      <div
        className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-black/45 shadow-[0_0_16px_rgba(0,0,0,0.4)] sm:h-20 sm:w-20"
        aria-label={alt}
      >
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-red-200/80">Club</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[4.25rem] w-[4.25rem] shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)] sm:h-20 sm:w-20"
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
      className="!border-[rgba(255,71,71,0.15)]"
      style={{ boxShadow: presentation.articleShadow }}
      data-feed-result-card="v2"
    >
      {/* feed-result-comments-v1: reserved slot for threaded comments MVP (no UI yet) */}
      <div data-feed-comment-slot="reserved" hidden aria-hidden />
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
      <FeedPostTypeBadge>Ergebnis</FeedPostTypeBadge>

      <div className={`${FEED_POST_BODY_CLASS} pb-3`}>
        <div className="relative overflow-hidden rounded-[20px] border border-[rgba(255,71,71,0.15)] px-3 pb-4 pt-4 shadow-[0_0_30px_rgba(227,29,47,0.1),inset_0_1px_0_rgba(255,255,255,0.04)]">
          {/* Stadion-Backdrop: Crowd-Silhouetten, Flutlicht oben, roter Nebel unten */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <img
              src={stadiumBgUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover object-[center_30%] opacity-[0.3] brightness-[0.56] saturate-[0.78]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,8,9,0.74)_0%,rgba(9,4,5,0.86)_52%,rgba(5,2,3,0.94)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-10%,rgba(255,240,220,0.16)_0%,transparent_62%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_50%_115%,rgba(227,29,47,0.22)_0%,transparent_64%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_8%_100%,rgba(227,29,47,0.12)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_22%)]" />
            {presentation.accentRadial ? (
              <div className="absolute inset-0" style={{ background: presentation.accentRadial }} />
            ) : null}
          </div>

          <div className="relative space-y-3">
            <FeedMatchMetaLine line={matchMetaLine} className="text-center" />

            <div className="space-y-1.5 text-center">
              <p className="text-[19px] font-black uppercase leading-none tracking-[0.22em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.7),0_0_18px_rgba(255,71,71,0.45)] sm:text-[22px] sm:tracking-[0.26em]">
                Endstand
              </p>
              <p
                className={`text-[12px] font-black uppercase leading-none tracking-[0.18em] sm:text-[13px] ${presentation.statusClass}`}
              >
                {presentation.status}
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 pt-0.5">
              <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Heim
                </span>
                <LogoBlock src={p.home_logo_url} alt={`${p.home_team_name} Logo`} />
                <FeedClubName fullName={p.home_team_name} variant="compact" className="w-full px-0.5" />
              </div>

              <p
                className="px-0.5 text-center text-[3.1rem] font-black tabular-nums leading-none tracking-tighter text-white min-[390px]:text-[3.6rem] sm:px-1 sm:text-[4.5rem] sm:tracking-tight"
                style={{ textShadow: presentation.scoreShadow }}
              >
                {p.home_score}
                <span className="mx-0.5 align-middle text-[0.5em] font-black text-red-400/70 sm:mx-1">
                  :
                </span>
                {p.away_score}
              </p>

              <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Gast
                </span>
                <LogoBlock src={p.away_logo_url} alt={`${p.away_team_name} Logo`} />
                <FeedClubName fullName={p.away_team_name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>

            {periodLine ? (
              <div className="flex justify-center">
                <span className="inline-flex items-center rounded-full border border-[rgba(255,71,71,0.12)] bg-black/35 px-3 py-1 text-[9px] font-semibold tabular-nums tracking-[0.08em] text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:text-[10px]">
                  Drittel {periodLine}
                </span>
              </div>
            ) : null}

            {metaLine ? (
              <p className="line-clamp-2 px-1 text-center text-[10px] leading-snug text-white/55 sm:text-[11px]">
                {metaLine}
              </p>
            ) : null}

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

        {filteredScorers.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-[rgba(255,71,71,0.12)] bg-black/35 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:px-4 sm:py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/85 sm:text-[11px] sm:tracking-[0.16em]">
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
