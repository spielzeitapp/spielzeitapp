import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResultFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { isValidLogoUrl } from '../../utils/logoResolver';
import { buildFeedMatchMetaLine, pickFeedAgeGroup } from '../../lib/feedClubNaming';
import { FeedClubName } from './FeedClubName';
import {
  FEED_POST_BODY_CLASS,
  FeedCaption,
  FeedGameCtaLink,
  FeedMatchDateVenueLine,
  FeedMatchMetaBadge,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedPostActionsFooter,
  FeedStandardActions,
  FeedStadiumHeroBackdrop,
  FEED_STADIUM_HERO_SHELL_CLASS,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
import { formatPeriodScoresBracketFromRaw } from '../../lib/matchEventScores';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
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

function formatScorerMinuteBadge(minuteLabel: string): string {
  const t = minuteLabel.trim();
  const m = /^(\d+(?:\+\d+)?)/.exec(t);
  if (m) return `[${m[1]}']`;
  return t;
}

type ResultVisualState = 'win' | 'draw' | 'loss';

const BASE_ARTICLE_SHADOW =
  'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 40px rgba(255,0,0,0.18), 0 14px 32px rgba(0,0,0,0.45)';

function formatResultMatchDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = new Intl.DateTimeFormat('de-AT', {
    weekday: 'short',
    timeZone: VIENNA_TZ,
  }).format(d);
  const datePart = new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: VIENNA_TZ,
  }).format(d);
  return `${weekday} ${datePart}`;
}

function resultPresentation(state: ResultVisualState) {
  if (state === 'win') {
    return {
      status: 'SIEG!',
      statusClass:
        'text-amber-300 [text-shadow:0_2px_10px_rgba(0,0,0,0.75),0_0_18px_rgba(251,191,36,0.35)]',
      articleShadow: `${BASE_ARTICLE_SHADOW}, 0 0 28px -8px rgba(220,38,38,0.2)`,
    };
  }
  if (state === 'loss') {
    return {
      status: 'SPIEL BEENDET',
      statusClass:
        'text-red-200/90 [text-shadow:0_2px_10px_rgba(0,0,0,0.75),0_0_18px_rgba(220,38,38,0.3)]',
      articleShadow: BASE_ARTICLE_SHADOW,
    };
  }
  return {
    status: 'PUNKTETEILUNG',
    statusClass:
      'text-white/92 [text-shadow:0_2px_10px_rgba(0,0,0,0.75),0_0_18px_rgba(255,255,255,0.2)]',
    articleShadow: BASE_ARTICLE_SHADOW,
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
        className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-black/55 shadow-[0_0_20px_rgba(227,29,47,0.22)] sm:h-[5.25rem] sm:w-[5.25rem]"
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
      className="h-[4.25rem] w-[4.25rem] shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)] sm:h-[5.25rem] sm:w-[5.25rem]"
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
  const matchDateLabel = useMemo(() => formatResultMatchDate(p.starts_at), [p.starts_at]);
  const venueLabel = useMemo(() => formatFeedVenueShort(p.location), [p.location]);
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
      data-feed-result-card="v7"
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
        <div className={FEED_STADIUM_HERO_SHELL_CLASS}>
          <FeedStadiumHeroBackdrop />

          <div className="relative min-w-0 space-y-4">
            <FeedMatchMetaBadge line={matchMetaLine} />

            <div className="space-y-1.5 text-center">
              <p className="text-[18px] font-black uppercase leading-none tracking-[0.22em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.85),0_0_22px_rgba(255,71,71,0.5)] sm:text-[23px] sm:tracking-[0.28em]">
                Endstand
              </p>
              <p
                className={`pt-2 text-[12px] font-black uppercase leading-none tracking-[0.18em] sm:text-[14px] sm:tracking-[0.2em] ${presentation.statusClass}`}
              >
                {presentation.status}
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:gap-x-6 md:gap-x-8">
              <div className="flex min-w-0 flex-col items-center justify-center gap-2 text-center sm:gap-2.5">
                <LogoBlock src={p.home_logo_url} alt={`${p.home_team_name} Logo`} />
                <FeedClubName fullName={p.home_team_name} variant="compact" className="w-full px-0.5" />
              </div>

              <div className="shrink-0 px-1 text-center sm:px-2">
                <p className="text-[3rem] font-black tabular-nums leading-none tracking-tight text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.75),0_0_32px_rgba(255,71,71,0.25)] min-[390px]:text-[3.35rem] sm:text-[4rem]">
                  {p.home_score}
                  <span className="mx-1.5 align-middle text-[0.42em] font-black text-white sm:mx-2.5">:</span>
                  {p.away_score}
                </p>
                {periodBracketLine ? (
                  <p className="mt-1.5 text-[11px] font-semibold tabular-nums leading-snug text-white/60 sm:text-[12px]">
                    {periodBracketLine}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col items-center justify-center gap-2 text-center sm:gap-2.5">
                <LogoBlock src={p.away_logo_url} alt={`${p.away_team_name} Logo`} />
                <FeedClubName fullName={p.away_team_name} variant="compact" className="w-full px-0.5" />
              </div>
            </div>

            {matchDateLabel || venueLabel ? (
              <div className="mx-auto max-w-[22rem] text-center">
                <FeedMatchDateVenueLine dateLabel={matchDateLabel} venueLabel={venueLabel} />
              </div>
            ) : null}

            {filteredScorers.length > 0 ? (
              <div className="rounded-2xl border border-[rgba(255,71,71,0.14)] bg-black/35 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:px-3 sm:py-3">
                <div className="mb-2.5 flex items-center gap-2 border-b border-red-500/20 pb-2">
                  <span className="text-[11px] leading-none opacity-90" aria-hidden>
                    ⚽
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200/95 sm:text-[11px]">
                    Torschützen
                  </p>
                  <div className="h-px flex-1 bg-gradient-to-r from-red-500/40 via-red-500/20 to-transparent" aria-hidden />
                </div>
                <ul className="space-y-1.5">
                  {filteredScorers.map((s, i) => {
                    const minOk = isSensibleScorerMinute(s.minute_label);
                    const minShown = minOk ? formatScorerMinuteBadge(s.minute_label) : null;
                    return (
                      <li
                        key={`${s.player_name}-${i}`}
                        className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 sm:px-2.5"
                      >
                        {minShown ? (
                          <span className="inline-flex shrink-0 rounded-full border border-red-500/40 bg-red-950/70 px-2 py-0.5 text-[10px] font-bold tabular-nums leading-none text-red-100 sm:text-[11px]">
                            {minShown}
                          </span>
                        ) : null}
                        <span className="shrink-0 text-[11px] leading-none opacity-90" aria-hidden>
                          ⚽
                        </span>
                        <span className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-snug text-white sm:text-[14px]">
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

            <div className="pt-1">
              <FeedGameCtaLink to={gameHref} />
            </div>
          </div>
        </div>
      </div>

      <FeedPostActionsFooter shareHint={shareHint}>
        <FeedStandardActions
          liked={liked}
          onToggleLike={onToggleLike}
          onShare={() => void onShare()}
          inFooter
        />
      </FeedPostActionsFooter>
    </FeedPostArticleShell>
  );
};
