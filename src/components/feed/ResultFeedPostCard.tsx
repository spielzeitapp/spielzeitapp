import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ResultFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { isValidLogoUrl } from '../../utils/logoResolver';
import { buildFeedMatchMetaLine, pickFeedAgeGroup } from '../../lib/feedClubNaming';
import { FeedClubName } from './FeedClubName';
import { dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
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
import { formatPeriodScoresBracketFromRaw } from '../../lib/matchEventScores';
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
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-black/45 shadow-[0_0_16px_rgba(0,0,0,0.4)] sm:h-[4.25rem] sm:w-[4.25rem]"
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
      className="h-14 w-14 shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)] sm:h-[4.25rem] sm:w-[4.25rem]"
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
  const periodBracketLine = useMemo(
    () => formatPeriodScoresBracketFromRaw(p.period_scores),
    [p.period_scores],
  );
  const captionTrim = post.caption?.trim() ?? '';

  const filteredScorers = useMemo(
    () => p.scorers.filter((s) => isRealScorerName(s.player_name)),
    [p.scorers],
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

  return (
    <FeedPostArticleShell
      className="!border-[rgba(255,71,71,0.15)]"
      style={{ boxShadow: presentation.articleShadow }}
      data-feed-result-card="v3"
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

      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-6`}>
        <div className="relative min-w-0 overflow-hidden rounded-none border-y border-[rgba(255,71,71,0.15)] px-2 pb-4 pt-3 shadow-[0_0_30px_rgba(227,29,47,0.1),inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-[20px] sm:border sm:px-2.5 sm:pb-4 sm:pt-3.5">
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

          <div className="relative min-w-0 space-y-3">
            {matchMetaLine ? (
              <FeedMatchMetaLine line={matchMetaLine} className="text-center" />
            ) : null}

            <div className="space-y-1 text-center">
              <p className="text-[17px] font-black uppercase leading-none tracking-[0.2em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.7),0_0_18px_rgba(255,71,71,0.45)] sm:text-[22px] sm:tracking-[0.26em]">
                Endstand
              </p>
              <p
                className={`text-[11px] font-black uppercase leading-none tracking-[0.16em] sm:text-[13px] sm:tracking-[0.18em] ${presentation.statusClass}`}
              >
                {presentation.status}
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-0.5 pt-0.5 sm:gap-1">
              <div className="flex min-w-0 flex-col items-center gap-0.5 text-center sm:gap-1">
                <LogoBlock src={p.home_logo_url} alt={`${p.home_team_name} Logo`} />
                <FeedClubName fullName={p.home_team_name} variant="compact" className="w-full px-0.5" />
              </div>

              <div className="flex min-w-0 flex-col items-center justify-center px-0.5 text-center">
                <p
                  className="text-[2.85rem] font-black tabular-nums leading-none tracking-tighter text-white min-[390px]:text-[3.25rem] sm:text-[4.25rem] sm:tracking-tight"
                  style={{ textShadow: presentation.scoreShadow }}
                >
                  {p.home_score}
                  <span className="mx-0.5 align-middle text-[0.5em] font-black text-red-400/70 sm:mx-1">
                    :
                  </span>
                  {p.away_score}
                </p>
                {periodBracketLine ? (
                  <p className="mt-0.5 max-w-[14rem] text-center text-[11px] font-medium tabular-nums leading-snug text-white/55 sm:max-w-none sm:text-[12px]">
                    {periodBracketLine}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col items-center gap-0.5 text-center sm:gap-1">
                <LogoBlock src={p.away_logo_url} alt={`${p.away_team_name} Logo`} />
                <FeedClubName fullName={p.away_team_name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>

            {filteredScorers.length > 0 ? (
              <div className="rounded-2xl border border-[rgba(255,71,71,0.12)] bg-black/35 px-1.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:px-2.5 sm:py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-200/90 sm:text-[11px]">
                  Torschützen
                </p>
                <ul className="mt-1.5 space-y-1">
                  {filteredScorers.map((s, i) => {
                    const minOk = isSensibleScorerMinute(s.minute_label);
                    const minShown = minOk ? s.minute_label.trim() : null;
                    return (
                      <li
                        key={`${s.player_name}-${i}`}
                        className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 rounded-lg bg-white/[0.03] px-1.5 py-1.5 sm:gap-x-2.5 sm:px-2.5"
                      >
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold tabular-nums leading-none text-red-200/90 sm:text-[12px]">
                          <span aria-hidden className="text-[12px]">
                            ⚽
                          </span>
                          {minShown ?? '–'}
                        </span>
                        <span className="min-w-0 break-words text-[13px] font-semibold leading-snug text-white sm:text-[14px]">
                          {s.player_name.trim()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {captionTrim ? (
              <div className="mt-0.5 rounded-2xl border border-white/[0.06] bg-black/30 px-2 py-2 sm:px-2.5 sm:py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-200/85 sm:text-[11px]">
                  Kurzbericht
                </p>
                <div className="mt-1 min-w-0">
                  <FeedCaption text={captionTrim} />
                </div>
              </div>
            ) : null}

            <div className="pt-0.5">
              <Link
                to={gameHref}
                className={[
                  'inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center',
                  dsSecondaryCtaClass(),
                  '!rounded-xl !py-2.5 !text-[14px] !font-semibold',
                ].join(' ')}
              >
                Zum Spiel
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className={`${FEED_CAPTION_FOOTER_CLASS} pb-[max(1.25rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))]`}>
        {shareHint ? <p className="text-center text-[12px] text-white/55">{shareHint}</p> : null}

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
