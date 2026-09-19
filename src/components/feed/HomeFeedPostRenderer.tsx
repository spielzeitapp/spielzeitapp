import React from 'react';
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

export const HomeFeedPostRenderer: React.FC<Props> = ({
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
