export type EventFeedPosterSource = 'custom' | 'generated' | 'none';
export type EventFeedPostMode = 'manual_only' | 'auto';

export type EventFeedSettingsRow = {
  id: string;
  event_id: string;
  team_season_id: string;
  poster_url: string | null;
  poster_storage_path: string | null;
  poster_source: EventFeedPosterSource;
  auto_post_enabled: boolean;
  post_offsets_days: number[];
  post_mode: EventFeedPostMode;
  prefer_custom_poster: boolean;
  caption_override: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertEventFeedSettingsInput = {
  event_id: string;
  team_season_id: string;
  poster_url?: string | null;
  poster_storage_path?: string | null;
  poster_source?: EventFeedPosterSource;
  auto_post_enabled?: boolean;
  post_offsets_days?: number[];
  post_mode?: EventFeedPostMode;
  prefer_custom_poster?: boolean;
  caption_override?: string | null;
  created_by?: string | null;
};
