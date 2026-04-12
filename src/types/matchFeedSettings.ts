import type { MatchFeedTemplateKey } from '../features/home/feedTemplates';

/** Logische Feed-Einstellungen (Quelle: `events`-Spalten show_in_feed / feed_template / …). */
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
