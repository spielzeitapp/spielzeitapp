import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResultFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { shareFeedContent } from '../../lib/feedShare';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { AutoFeedPostMediaEditButton } from './AutoFeedPostMediaEditButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { pickFeedAgeGroup } from '../../lib/feedClubNaming';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedGameCtaLink,
  FeedPostHeader,
  FeedPostActionsFooter,
  FeedStandardActions,
  FEED_STADIUM_HERO_SHELL_CLASS,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
import { formatPeriodScoresBracketFromRaw } from '../../lib/matchEventScores';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';
import { useInternalBasePath } from '../../demo/demoPaths';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { matchdayPosterDomToPngBlob } from '../../lib/matchdayPosterExport';
import { buildAutoResultCaption } from '../../lib/resultFeedTypes';
import { ResultPosterArtwork } from './ResultPosterArtwork';

type Props = {
  post: ResultFeedPostRow;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
  onFeedPostUpdated?: () => void;
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

function formatScorerMinute(minuteLabel: string): string {
  const t = minuteLabel.trim();
  const m = /^(\d+(?:\+\d+)?)/.exec(t);
  if (m) return `${m[1]}′`;
  return t;
}

type GroupedScorer = {
  playerName: string;
  goalCount: number;
  minutes: string[];
};

function groupScorersByPlayer(
  scorers: ResultFeedPostRow['payload']['scorers'],
): GroupedScorer[] {
  const groups = new Map<string, GroupedScorer>();

  scorers.forEach((scorer) => {
    if (!isRealScorerName(scorer.player_name)) return;

    const playerName = scorer.player_name.trim().replace(/\s+/g, ' ');
    const key = playerName.toLocaleLowerCase('de-AT');
    const existing = groups.get(key);
    const minute = isSensibleScorerMinute(scorer.minute_label)
      ? formatScorerMinute(scorer.minute_label)
      : null;

    if (existing) {
      existing.goalCount += 1;
      if (minute) existing.minutes.push(minute);
      return;
    }

    groups.set(key, {
      playerName,
      goalCount: 1,
      minutes: minute ? [minute] : [],
    });
  });

  return Array.from(groups.values());
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

export const ResultFeedPostCard: React.FC<Props> = ({
  post,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
  onFeedPostUpdated,
}) => {
  const p = post.payload;
  const [liked, setLiked] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const resultPosterRef = useRef<HTMLDivElement | null>(null);
  const posterBlobRef = useRef<Blob | null>(null);
  const customImageSrc = useFeedMediaSrc(post.media_url);
  const hasCustomImage = Boolean(post.media_url?.trim());

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setImageAspectRatio(null);
  }, [post.media_url]);

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
  const captionTrim = useMemo(() => {
    const saved = post.caption?.trim() ?? '';
    const ownSaved = p.our_team_name?.trim() ?? '';
    const ownSeason = teamLabel.trim();
    if (!saved || !ownSaved || !ownSeason || ownSaved === ownSeason) return saved;
    const opponent = p.is_home ? p.away_team_name : p.home_team_name;
    const generated = buildAutoResultCaption({
      ourTeamName: ownSaved,
      opponentName: opponent,
      homeScore: p.home_score,
      awayScore: p.away_score,
      resultState: p.result_state,
    });
    // Nur unveränderte Vorlagentexte berichtigen; individuelle Texte behalten ihren Wortlaut.
    return saved === generated
      ? buildAutoResultCaption({
          ourTeamName: ownSeason,
          opponentName: opponent,
          homeScore: p.home_score,
          awayScore: p.away_score,
          resultState: p.result_state,
        })
      : saved;
  }, [post.caption, p.our_team_name, p.is_home, p.home_team_name, p.away_team_name, p.home_score, p.away_score, p.result_state, teamLabel]);

  const groupedScorers = useMemo(() => groupScorersByPlayer(p.scorers), [p.scorers]);

  // Das automatisch gerenderte Ergebnis wird bereits vor dem Tippen auf „Teilen“
  // als PNG vorbereitet. Auf iOS muss navigator.share zeitnah zum Tap starten.
  useEffect(() => {
    posterBlobRef.current = null;
    if (hasCustomImage) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const poster = resultPosterRef.current;
      if (!poster) return;
      void matchdayPosterDomToPngBlob(poster).then((blob) => {
        if (active) posterBlobRef.current = blob;
      });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [hasCustomImage, p.home_score, p.away_score, p.home_team_name, p.away_team_name,
    p.home_logo_url, p.away_logo_url, p.scorers, p.starts_at, p.location,
    p.period_scores, p.is_home, p.match_type, teamLabel]);

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
  const basePath = useInternalBasePath();

  const gameHref = useMemo(
    () => {
      // Ein Ergebnis gehört zur abgeschlossenen Termin-Zusammenfassung
      // (Spielbericht + Statistik), nicht mehr zur Match-Vorbereitung.
      if (p.event_id?.trim()) {
        return `${basePath}/events/${encodeURIComponent(p.event_id.trim())}`;
      }
      return resolveMatchGameHref({
        matchId: p.match_id,
        eventId: p.event_id,
        status: 'finished',
        canManage: viewerIsStaff || basePath === '/demo',
        basePath,
      });
    },
    [p.match_id, p.event_id, viewerIsStaff, basePath],
  );

  const onShare = useCallback(async () => {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '');
    const path = gameHref.startsWith('/') ? gameHref : `/${gameHref}`;
    const url = `${window.location.origin}${base}${path}`;
    const title = 'SpielzeitApp · Ergebnis';
    const scorerLine = groupedScorers.length > 0
      ? `\nTorschützen: ${groupedScorers.map((scorer) => `${scorer.playerName}${scorer.minutes.length ? ` (${scorer.minutes.join(', ')})` : ''}`).join(' · ')}`
      : '';
    const text = `${captionTrim}\n${p.home_team_name} ${p.home_score}:${p.away_score} ${p.away_team_name}${scorerLine}`;
    const posterFile = !hasCustomImage && posterBlobRef.current
      ? new File([posterBlobRef.current], `spielzeit-endstand-${post.id.slice(0, 8)}.png`, { type: 'image/png' })
      : null;
    const outcome = await shareFeedContent({
      title,
      text: `${text}\n${url}`,
      file: posterFile,
      fetchUrl: hasCustomImage ? customImageSrc : null,
      fileName: hasCustomImage ? `spielzeit-ergebnis-${post.id.slice(0, 8)}.webp` : undefined,
      mimeType: hasCustomImage ? 'image/webp' : undefined,
    });
    if (outcome === 'aborted') return;
    if (outcome === 'shared') setShareHint('Geteilt.');
    else if (outcome === 'copied') setShareHint('Text kopiert.');
    else setShareHint('Teilen nicht möglich.');
    window.setTimeout(() => setShareHint(null), 2400);
  }, [captionTrim, post.id, p.away_score, p.away_team_name, gameHref, p.home_score, p.home_team_name, hasCustomImage, customImageSrc, groupedScorers]);

  const headerActions = staffCanDelete && onFeedPostDeleted ? (
    <div className="flex items-center gap-2">
      <AutoFeedPostMediaEditButton post={post} title="Siegerbild" initialCaption={captionTrim} onUpdated={onFeedPostUpdated ?? onFeedPostDeleted} />
      <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
    </div>
  ) : null;

  if (hasCustomImage) {
    return (
      <FeedPostArticleShell className="" style={{ boxShadow: presentation.articleShadow }} data-feed-result-card="custom-image-v1">
        <FeedPostHeader
          teamLabel={teamLabel}
          seasonLabel={seasonLabel}
          whenLabel={whenLabel}
          headerClassName="bg-black/25"
          actions={headerActions}
        />
        <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-2`}>
          <div
            className="sz-club-feed-media-frame relative max-h-[min(78vh,720px)] w-full overflow-hidden rounded-none border-y bg-black sm:rounded-2xl sm:border"
            style={{ aspectRatio: imageAspectRatio ?? 4 / 5 }}
          >
            {customImageSrc && !imageFailed ? (
              <img
                src={customImageSrc}
                data-whatsapp-status-image
                alt={`Siegerbild: ${p.home_team_name} ${p.home_score}:${p.away_score} ${p.away_team_name}`}
                className={`h-full w-full object-contain transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                decoding="async"
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                    setImageAspectRatio(image.naturalWidth / image.naturalHeight);
                  }
                  setImageLoaded(true);
                }}
                onError={() => setImageFailed(true)}
              />
            ) : null}
            {!imageLoaded ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(160deg,rgba(42,12,17,0.55),rgba(0,0,0,0.96))] text-xs font-medium text-white/45">
                {imageFailed ? 'Bild konnte nicht geladen werden.' : 'Bild wird geladen…'}
              </div>
            ) : null}
          </div>

          {captionTrim ? (
            <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}>
              <FeedCaption text={captionTrim} />
            </div>
          ) : null}

          <div className="px-2 pt-2 sm:px-0">
            <FeedGameCtaLink to={gameHref}>Zur Zusammenfassung</FeedGameCtaLink>
          </div>

          <FeedPostActionsFooter shareHint={shareHint}>
            <FeedStandardActions liked={liked} onToggleLike={onToggleLike} onShare={() => void onShare()} inFooter whatsAppStatus />
          </FeedPostActionsFooter>
        </div>
      </FeedPostArticleShell>
    );
  }

  return (
    <FeedPostArticleShell
      className=""
      style={{ boxShadow: presentation.articleShadow }}
      data-feed-result-card="clean-v1"
    >
      {/* feed-result-comments-v1: reserved slot for threaded comments MVP (no UI yet) */}
      <div data-feed-comment-slot="reserved" hidden aria-hidden />
      <FeedPostHeader
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        whenLabel={whenLabel}
        headerClassName="bg-black/25"
        actions={headerActions}
      />
      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-2`}>
        <div data-whatsapp-status-poster className={FEED_STADIUM_HERO_SHELL_CLASS}>
          <ResultPosterArtwork
            ref={resultPosterRef}
            payload={p}
            ageGroup={pickFeedAgeGroup(teamLabel, p.home_team_name, p.away_team_name)}
            competition={getMatchTypeLabel(p.match_type ?? undefined) ?? 'Spiel'}
            periods={periodBracketLine}
            date={matchDateLabel}
            venue={venueLabel}
            scorers={groupedScorers.map(scorer => ({
              playerName: scorer.playerName,
              detail: scorer.minutes.length > 0 ? scorer.minutes.join(' · ') : `${scorer.goalCount} ${scorer.goalCount === 1 ? 'Tor' : 'Tore'}`,
            }))}
          />

            {captionTrim ? (
              <div className="sz-club-feed-inset mt-0.5 rounded-2xl border px-2 py-2 sm:px-2.5 sm:py-2.5">
                <p className="sz-club-feed-accent-text text-[10px] font-black uppercase tracking-[0.14em] sm:text-[11px]">
                  Kurzbericht
                </p>
                <div className="mt-1 min-w-0">
                  <FeedCaption text={captionTrim} />
                </div>
              </div>
            ) : null}

            <div className="pt-1">
              <FeedGameCtaLink to={gameHref}>Zur Zusammenfassung</FeedGameCtaLink>
            </div>
        </div>
      </div>

      <FeedPostActionsFooter shareHint={shareHint}>
        <FeedStandardActions
          liked={liked}
          onToggleLike={onToggleLike}
          onShare={() => void onShare()}
          inFooter whatsAppStatus
        />
      </FeedPostActionsFooter>
    </FeedPostArticleShell>
  );
};
