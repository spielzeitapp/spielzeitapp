import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventRow } from '../../hooks/useEvents';import type { MatchdayFeedPayload, TeamFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { getClubLogo } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import { supabase } from '../../lib/supabaseClient';
import {
  MatchdayPosterCard,
  type MatchdayAnnouncementTiming,
  type MatchdayPosterVisualStatus,
} from './MatchdayPosterCard';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { matchdayPosterDomToPngBlob } from '../../lib/matchdayPosterExport';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_BODY_INSET_CLASS,
  FEED_POST_CAPTION_AFTER_MEDIA_CLASS,
  FeedCaption,
  FeedGameCtaLink,
  FeedPostActionsFooter,
  FeedPostHeader,
  FeedPostTypeBadge,
  FeedStandardActions,
  FEED_STADIUM_ARTICLE_SHADOW,
} from './feedTypography';
import { FeedPostArticleShell } from './FeedPostArticleShell';
import { resolveMatchGameHref } from '../../lib/matchFeedLink';
import { useSession } from '../../auth/useSession';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';

type Props = {
  post: TeamFeedPostRow;
  /** Aktueller Termin aus dem Kalender — für LIVE / ENDSTAND / Logos live halten. */
  liveEvent?: EventRow | null;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

function likeStorageKey(postId: string): string {
  return `spz_feed_like_${postId}`;
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, hour: '2-digit', minute: '2-digit' }).format(d) +
    ' Uhr'
  );
}

export const MatchdayFeedPostCard: React.FC<Props> = ({
  post,
  liveEvent,
  teamLabel,
  staffCanDelete,
  onFeedPostDeleted,
}) => {
  const p = post.payload as MatchdayFeedPayload;
  const announcementTiming = useMemo((): MatchdayAnnouncementTiming | null => {
    if (p.matchday_timing === 'today' || p.matchday_timing === 'tomorrow') {
      return p.matchday_timing;
    }
    const postKind = (post.post_kind ?? '').toLowerCase().trim();
    if (postKind === 'matchday_today_auto') return 'today';
    if (postKind === 'matchday_tomorrow_auto') return 'tomorrow';
    return null;
  }, [p.matchday_timing, post.post_kind]);
  const posterCaptureRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [scores, setScores] = useState<{ home: number; away: number } | null>(null);

  useEffect(() => {
    try {
      setLiked(sessionStorage.getItem(likeStorageKey(post.id)) === '1');
    } catch {
      setLiked(false);
    }
  }, [post.id]);

  const eventStatus = liveEvent?.status ?? 'upcoming';
  const matchId = liveEvent?.match_id ?? p.match_id;

  useEffect(() => {
    if (eventStatus !== 'finished' || !matchId) {
      setScores(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('score_home, score_away')
        .eq('id', matchId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const row = data as { score_home?: number; score_away?: number };
      setScores({
        home: Number(row.score_home ?? 0),
        away: Number(row.score_away ?? 0),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [eventStatus, matchId]);

  const posterStatus: MatchdayPosterVisualStatus = useMemo(() => {
    if (eventStatus === 'live') return 'live';
    if (eventStatus === 'finished') return 'finished';
    return 'today';
  }, [eventStatus]);

  const homeLogoUrl = useMemo(() => {
    if (p.is_home) return getClubLogo(p.our_team_name);
    return getClubLogo(p.display_home_name, { logoUrl: p.opponent_logo_url });
  }, [p]);

  const awayLogoUrl = useMemo(() => {
    if (p.is_home) return getClubLogo(p.display_away_name, { logoUrl: p.opponent_logo_url });
    return getClubLogo(p.our_team_name);
  }, [p]);

  const locationLine = useMemo(() => {
    const raw = (p.location ?? '').trim() || (p.address ?? '').trim() || null;
    return formatFeedVenueShort(raw) ?? '—';
  }, [p.location, p.address]);

  const meetingTime = p.meeting_iso ? formatMeetupTimeOnlyDe(p.meeting_iso) : null;
  const kickoffTime = formatKickoff(p.kickoff_iso);

  const venueLabel = (liveEvent?.is_home ?? p.is_home) === false ? 'Auswärtsspiel' : 'Heimspiel';

  const { backendRole, membershipRole } = useSession();
  const viewerIsStaff = canStaffManageTeamFeed(backendRole, membershipRole);

  const gameHref = useMemo(
    () =>
      resolveMatchGameHref({
        matchId: p.match_id ?? liveEvent?.match_id,
        eventId: p.event_id,
        status: eventStatus,
        canManage: viewerIsStaff,
      }),
    [p.match_id, p.event_id, liveEvent?.match_id, eventStatus, viewerIsStaff],
  );

  const onShare = useCallback(async () => {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '');
    const path = gameHref.startsWith('/') ? gameHref : `/${gameHref}`;
    const url = `${window.location.origin}${base}${path}`;
    const kickDate = new Date(p.kickoff_iso);
    const datePart = Number.isNaN(kickDate.getTime())
      ? ''
      : ` · ${new Intl.DateTimeFormat('de-AT', {
          timeZone: VIENNA_TZ,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(kickDate)}`;
    const text = `${post.caption}\n${p.display_home_name} vs. ${p.display_away_name}${datePart} · Anpfiff ${kickoffTime}`;
    const title = 'SpielzeitApp · Matchday';
    const textAndLink = `${text}\n${url}`;

    let posterBlob: Blob | null = null;
    if (posterCaptureRef.current) {
      posterBlob = await matchdayPosterDomToPngBlob(posterCaptureRef.current);
    }

    const tryShareWithPng = async (): Promise<boolean> => {
      if (!posterBlob || posterBlob.size < 64) return false;
      if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
      const file = new File([posterBlob], `spielzeit-matchday-${p.event_id.slice(0, 8)}.png`, {
        type: 'image/png',
      });
      const withAll: ShareData = { files: [file], title, text, url };
      const withText: ShareData = { files: [file], title, text: textAndLink };
      const withTitle: ShareData = { files: [file], title };
      const filesOnly: ShareData = { files: [file] };
      const ordered: ShareData[] = [];
      if (typeof navigator.canShare === 'function') {
        if (navigator.canShare(withAll)) ordered.push(withAll);
        if (navigator.canShare(withText)) ordered.push(withText);
        if (navigator.canShare(withTitle)) ordered.push(withTitle);
        if (navigator.canShare(filesOnly)) ordered.push(filesOnly);
      }
      if (ordered.length === 0) ordered.push(withAll, withText, withTitle, filesOnly);
      for (const data of ordered) {
        try {
          await navigator.share(data);
          return true;
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') throw e;
        }
      }
      return false;
    };

    const tryNativeTextShare = async (): Promise<boolean> => {
      if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
      const withUrl: ShareData = { title, text, url };
      const textOnly: ShareData = { title, text: textAndLink };
      const can = typeof navigator.canShare === 'function' ? navigator.canShare.bind(navigator) : () => true;
      const candidates: ShareData[] = [];
      if (can(withUrl)) candidates.push(withUrl);
      else if (can(textOnly)) candidates.push(textOnly);
      else candidates.push(withUrl, textOnly);
      for (const data of candidates) {
        try {
          await navigator.share(data);
          return true;
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') throw e;
        }
      }
      return false;
    };

    try {
      if (await tryShareWithPng()) return;
    } catch {
      return;
    }
    try {
      if (await tryNativeTextShare()) return;
    } catch {
      return;
    }
    try {
      if (
        posterBlob &&
        typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.write === 'function'
      ) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': posterBlob })]);
        setShareHint('Bild in Zwischenablage kopiert.');
        window.setTimeout(() => setShareHint(null), 2500);
        return;
      }
    } catch {
      /* Fallback: Text */
    }
    try {
      await navigator.clipboard.writeText(textAndLink);
      setShareHint('Text & Link kopiert.');
      window.setTimeout(() => setShareHint(null), 2500);
    } catch {
      setShareHint('Teilen nicht möglich.');
      window.setTimeout(() => setShareHint(null), 2500);
    }
  }, [
    post.caption,
    p.display_home_name,
    p.display_away_name,
    p.kickoff_iso,
    p.event_id,
    kickoffTime,
    gameHref,
  ]);

  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);

  const onToggleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    try {
      sessionStorage.setItem(likeStorageKey(post.id), next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [liked, post.id]);

  return (
    <FeedPostArticleShell
      className="!border-[rgba(255,71,71,0.15)]"
      style={{ boxShadow: FEED_STADIUM_ARTICLE_SHADOW }}
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
      <FeedPostTypeBadge>
        {announcementTiming === 'today'
          ? 'Spieltag · Heute'
          : announcementTiming === 'tomorrow'
            ? 'Spieltag · Morgen'
            : 'Spieltag'}
      </FeedPostTypeBadge>

      <div className={`${FEED_POST_BODY_CLASS} min-w-0 pb-6`}>
        <MatchdayPosterCard
          ref={posterCaptureRef}
          homeTeamName={p.display_home_name}
          awayTeamName={p.display_away_name}
          homeLogoUrl={homeLogoUrl}
          awayLogoUrl={awayLogoUrl}
          kickoffTime={kickoffTime}
          meetingTime={meetingTime}
          locationLine={locationLine}
          venueLabel={venueLabel}
          status={posterStatus}
          homeScore={scores?.home ?? null}
          awayScore={scores?.away ?? null}
          matchType={p.match_type}
          announcementTiming={announcementTiming}
        />

        {post.caption?.trim() ? (
          <div className={FEED_POST_CAPTION_AFTER_MEDIA_CLASS}>
            <FeedCaption text={post.caption} />
          </div>
        ) : null}

        <div className={`${FEED_POST_BODY_INSET_CLASS} pt-1`}>
          <FeedGameCtaLink to={gameHref} />
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
