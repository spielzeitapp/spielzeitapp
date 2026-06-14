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

type Props = {
  item: ClassifiedFeedPost;
  eventById: Map<string, EventRow>;
  teamLabel: string;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

export const HomeFeedPostRenderer: React.FC<Props> = ({
  item,
  eventById,
  teamLabel,
  staffCanDelete,
  onFeedPostDeleted,
}) => {
  if (item.kind === 'live') {
    return (
      <LiveFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
      />
    );
  }
  if (item.kind === 'next_match') {
    return (
      <NextMatchFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
      />
    );
  }
  if (item.kind === 'lineup') {
    return (
      <LineupFeedPostCard
        post={item.post}
        liveEvent={item.post.event_id ? eventById.get(item.post.event_id) ?? null : null}
        teamLabel={teamLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
      />
    );
  }
  if (item.kind === 'matchday') {
    return (
      <MatchdayFeedPostCard
        post={item.post}
        liveEvent={item.post.event_id ? eventById.get(item.post.event_id) ?? null : null}
        teamLabel={teamLabel}
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
      />
    );
  }
  if (item.kind === 'video') {
    return (
      <VideoFeedPostCard
        post={item.post}
        teamLabel={teamLabel}
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
        staffCanDelete={staffCanDelete}
        onFeedPostDeleted={onFeedPostDeleted}
      />
    );
  }
  return (
    <ImageFeedPostCard
      post={item.post}
      teamLabel={teamLabel}
      staffCanDelete={staffCanDelete}
      onFeedPostDeleted={onFeedPostDeleted}
    />
  );
};
