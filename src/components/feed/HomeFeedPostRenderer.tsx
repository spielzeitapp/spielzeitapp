import React from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { publicTeamTournamentPath } from '../../lib/publicTeamTournamentPath';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { ParticipantLogoChip } from '../live/ParticipantLogoChip';
import { FeedPostCtaButton } from './FeedPostCtaButton';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { FeedPostHeader } from './feedTypography';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { useMatchClubBranding } from '../../hooks/useMatchClubBranding';
import type { ClassifiedFeedPost } from '../../lib/matchdayFeedTypes';
import type { EventRow } from '../../hooks/useEvents';
import { MatchdayFeedPostCard } from './MatchdayFeedPostCard';
import { VideoFeedPostCard } from './VideoFeedPostCard';
import { ImageFeedPostCard } from './ImageFeedPostCard';
import { ResultFeedPostCard } from './ResultFeedPostCard';
import { NextMatchFeedPostCard } from './NextMatchFeedPostCard';
import { LiveFeedPostCard } from './LiveFeedPostCard';
import { LineupFeedPostCard } from './LineupFeedPostCard';
import { SquadFeedPostCard } from './SquadFeedPostCard';
import { TournamentCompletionFeedPostCard } from './TournamentCompletionFeedPostCard';
import {
  ChampionshipMatchChangedFeedPostCard,
  ChampionshipScheduleFeedPostCard,
} from './ChampionshipScheduleFeedPostCard';

type Props = {
  item: ClassifiedFeedPost;
  eventById: Map<string, EventRow>;
  finishedEventIds: Set<string>;
  teamLabel: string;
  /** Saison-Badge der Post-Saison, z. B. „U11 · 2025/26“. */
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: (postId: string) => void;
  onFeedPostUpdated?: () => void;
};

const FeedPostContent: React.FC<Props> = ({
  item,
  eventById,
  finishedEventIds,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted: notifyFeedPostDeleted,
  onFeedPostUpdated,
}) => {
  const eventId = (item.post.event_id ?? '').trim();
  const linkedEvent = eventId ? eventById.get(eventId) ?? null : null;
  const linkedEventStatus = eventId && finishedEventIds.has(eventId)
    ? 'finished'
    : linkedEvent?.status ?? null;
  const onFeedPostDeleted = notifyFeedPostDeleted
    ? () => notifyFeedPostDeleted(item.post.id)
    : undefined;

  const livestreamImage = useFeedMediaSrc(item.kind === 'tournament_livestream' ? item.post.media_url : null, 'feed');
  if (item.kind === 'tournament_livestream') {
    const payload = item.post.payload as { participants?: unknown } | null;
    const participants = Array.isArray(payload?.participants)
      ? payload.participants.filter((entry): entry is { name: string; logoUrl?: string } =>
        entry && typeof entry.name === 'string' && entry.name.trim().length > 0)
      : [];
    return <article className="rounded-2xl border border-white/15 p-4">
      <FeedPostHeader teamLabel={teamLabel} seasonLabel={seasonLabel} whenLabel={formatDateTimeMediumDeVienna(item.post.created_at)}
        actions={staffCanDelete && onFeedPostDeleted
          ? <FeedPostDeleteButton input={toFeedPostDeleteInput(item.post)} onDeleted={onFeedPostDeleted} />
          : null} />
      {livestreamImage ? <img src={livestreamImage} alt="Turniermotiv" loading="lazy"
        className="mt-3 aspect-video w-full rounded-xl object-cover" /> : null}
      {participants.length ? (
        <ul aria-label="Teilnehmende Mannschaften" className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3">
          {participants.map(({ name, logoUrl }) => <li key={name} className="min-w-0">
            <ParticipantLogoChip teamName={name} logoUrl={logoUrl} carousel showHomeBadge={false} />
          </li>)}
        </ul>
      ) : null}
      <p className="py-3 font-bold">{item.post.caption}</p>
      {eventId && item.post.cta_url ? (
        <Link to={`${publicTeamTournamentPath(eventId)}#livestream`}
          className={`${dsPrimaryCtaClass()} mt-3 flex min-h-12 w-full items-center justify-center gap-2 px-4 py-3 text-[13px] font-bold uppercase tracking-[0.04em]`}>
          <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden />
          {item.post.cta_label || 'Zur Turnierseite'}
        </Link>
      ) : <FeedPostCtaButton ctaUrl={item.post.cta_url} ctaLabel={item.post.cta_label} />}
    </article>;
  }
  if (item.kind === 'tournament_squad') {
    const payload = item.post.payload as { title?: unknown; players?: unknown } | null;
    const players = Array.isArray(payload?.players)
      ? payload.players.filter((entry): entry is string => typeof entry === 'string') : [];
    return (
      <article className="sz-club-feed-shell rounded-2xl border p-4">
        <FeedPostHeader teamLabel={teamLabel} seasonLabel={seasonLabel} whenLabel={formatDateTimeMediumDeVienna(item.post.created_at)}
          actions={staffCanDelete && onFeedPostDeleted
            ? <FeedPostDeleteButton input={toFeedPostDeleteInput(item.post)} onDeleted={onFeedPostDeleted} />
            : null} />
        <h2 className="mt-3 text-lg font-bold">{typeof payload?.title === 'string' ? payload.title : 'Turnierkader'}</h2>
        <p className="mt-1 text-sm text-white/70">{item.post.caption}</p>
        <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label="Spieler im Turnierkader">
          {players.map((name, index) => <li key={index}>{name}</li>)}
        </ul>
        {eventId && <Link className={`${dsPrimaryCtaClass()} mt-4 flex min-h-11 items-center justify-center px-4`}
          to={`/app/events/${encodeURIComponent(eventId)}`}>Zum Turnier</Link>}
      </article>
    );
  }
  if (item.kind === 'live') {
    return (
      <LiveFeedPostCard
        post={item.post}
        liveEvent={linkedEvent}
        eventStatus={linkedEventStatus}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'next_match') {
    return (
      <NextMatchFeedPostCard
        post={item.post}
        liveEvent={linkedEvent}
        eventStatus={linkedEventStatus}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'lineup') {
    return (
      <LineupFeedPostCard
        post={item.post}
        liveEvent={linkedEvent}
        eventStatus={linkedEventStatus}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'squad') {
    return (
      <SquadFeedPostCard
        post={item.post}
        liveEvent={linkedEvent}
        eventStatus={linkedEventStatus}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'matchday') {
    return (
      <MatchdayFeedPostCard
        post={item.post}
        liveEvent={linkedEvent}
        eventStatus={linkedEventStatus}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'video') {
    return (
      <VideoFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
      />
    );
  }
  if (item.kind === 'result') {
    return (
      <ResultFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'tournament_completion') {
    return (
      <TournamentCompletionFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'championship_schedule') {
    return (
      <ChampionshipScheduleFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  if (item.kind === 'championship_match_changed') {
    return (
      <ChampionshipMatchChangedFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
        seasonLabel={seasonLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
        onFeedPostUpdated={onFeedPostUpdated}
      />
    );
  }
  return (
    <ImageFeedPostCard
      post={item.post}
      teamLabel={teamLabel}
      seasonLabel={seasonLabel}
      staffCanDelete={staffCanDelete}
      onFeedPostDeleted={onFeedPostDeleted}
      onFeedPostUpdated={onFeedPostUpdated}
    />
  );
};

/** Keep the whole post in its own club palette, including in mixed favourites. */
export const HomeFeedPostRenderer: React.FC<Props> = (props) => {
  const { style } = useMatchClubBranding(props.item.post.team_season_id);
  return <div className="sz-feed-club-scope contents" style={style}>
    <FeedPostContent {...props} />
  </div>;
};
