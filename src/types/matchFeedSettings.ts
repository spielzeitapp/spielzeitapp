import type { MatchFeedTemplateKey } from '../features/home/feedTemplates';

/** Zeile aus `public.match_feed_settings`. */
export type MatchFeedSettingsRow = {
  id: string;
  event_id: string;
  is_feed_enabled: boolean;
  template_key: MatchFeedTemplateKey;
  player_image_url: string | null;
  opponent_logo_url: string | null;
  headline_override: string | null;
  subline_override: string | null;
  created_at: string;
  updated_at: string;
};
