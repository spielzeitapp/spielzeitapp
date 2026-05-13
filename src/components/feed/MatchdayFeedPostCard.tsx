import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import type { MatchdayFeedPayload, TeamFeedPostRow } from '../../lib/matchdayFeedTypes';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { getClubLogo } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import { supabase } from '../../lib/supabaseClient';
import { MatchdayPosterCard, type MatchdayPosterVisualStatus } from './MatchdayPosterCard';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { matchdayPosterDomToPngBlob } from '../../lib/matchdayPosterExport';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';

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
    const parsed = splitCombinedLocation(p.location || null);
    const place = parsed.place;
    const addr = parsed.address || (p.address ?? '').trim();
    return (formatFullLocation(place, addr) || '').trim() || '—';
  }, [p.location, p.address]);

  const meetingTime = p.meeting_iso ? formatMeetupTimeOnlyDe(p.meeting_iso) : null;
  const kickoffTime = formatKickoff(p.kickoff_iso);

  const venueLabel = (liveEvent?.is_home ?? p.is_home) === false ? 'Auswärtsspiel' : 'Heimspiel';

  const deepLink = p.deep_link?.startsWith('/') ? p.deep_link : `/app/events/${p.event_id}`;

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
    const path = deepLink.startsWith('/') ? deepLink : `/${deepLink}`;
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
    deepLink,
  ]);

  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);

  return (
    <article
      className="w-full min-w-0 overflow-hidden rounded-3xl border border-red-950/40 bg-[#0a0a0a] shadow-xl"
      style={{
        boxShadow:
          'inset 0 0 80px rgba(80,10,10,0.08), 0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.07)',
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.05] bg-black/25 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <FeedCardHeaderBrand teamLabel={teamLabel} />
          <p className="mt-1 text-xs text-white/65">{whenLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {staffCanDelete && onFeedPostDeleted ? (
            <FeedPostDeleteButton input={toFeedPostDeleteInput(post)} onDeleted={onFeedPostDeleted} />
          ) : null}
          <span className="shrink-0 rounded-full border border-red-500/25 bg-red-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/95">
            Matchday
          </span>
        </div>
      </header>

      <div className="min-w-0 space-y-4 px-3 pb-4 pt-4 sm:px-5">
        <p className="text-[15px] font-medium leading-relaxed text-white/95 sm:text-base">{post.caption}</p>
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
        />
        {shareHint ? (
          <p className="text-center text-[13px] text-white/65">{shareHint}</p>
        ) : null}
        <div
          className="flex items-center justify-between gap-1 border-t border-white/[0.06] pt-3.5"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(220,38,38,0.04)',
          }}
        >
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-colors ${
              liked ? 'text-red-400' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/88'
            }`}
            aria-pressed={liked}
          >
            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} strokeWidth={2} />
            Gefällt mir
          </button>
          <Link
            to={`/app/events/${p.event_id}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white/68 transition-colors hover:bg-white/[0.06] hover:text-white/92"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            Kommentar
          </Link>
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white/68 transition-colors hover:bg-white/[0.06] hover:text-white/92 active:bg-white/[0.08]"
            aria-label="Matchday teilen"
          >
            <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} />
            Teilen
          </button>
        </div>
      </div>
    </article>
  );
};
