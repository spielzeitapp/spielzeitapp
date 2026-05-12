import React from 'react';
import type { ClassifiedFeedPost } from '../../lib/matchdayFeedTypes';
import type { EventRow } from '../../hooks/useEvents';
import { MatchdayFeedPostCard } from './MatchdayFeedPostCard';
import { VideoFeedPostCard } from './VideoFeedPostCard';
import { ImageFeedPostCard } from './ImageFeedPostCard';

type Props = {
  item: ClassifiedFeedPost;
  eventById: Map<string, EventRow>;
  teamLabel: string;
};

export const HomeFeedPostRenderer: React.FC<Props> = ({ item, eventById, teamLabel }) => {
  if (item.kind === 'matchday') {
    return (
      <MatchdayFeedPostCard
        post={item.post}
        liveEvent={eventById.get(item.post.event_id)}
        teamLabel={teamLabel}
      />
    );
  }
  if (item.kind === 'video') {
    return <VideoFeedPostCard post={item.post} teamLabel={teamLabel} />;
  }
  return <ImageFeedPostCard post={item.post} teamLabel={teamLabel} />;
};
