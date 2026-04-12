-- Feed-Templates: hero_* → spieltag_* (CHECK + Defaults + bestehende Zeilen)
UPDATE public.match_feed_settings SET template_key = 'spieltag_clean' WHERE template_key = 'hero_clean';
UPDATE public.match_feed_settings SET template_key = 'spieltag_hero_player_right' WHERE template_key = 'hero_red_player_right';

ALTER TABLE public.match_feed_settings DROP CONSTRAINT IF EXISTS match_feed_settings_template_key_check;

ALTER TABLE public.match_feed_settings
  ALTER COLUMN template_key SET DEFAULT 'spieltag_clean',
  ADD CONSTRAINT match_feed_settings_template_key_check
  CHECK (template_key IN ('spieltag_hero_player_right', 'spieltag_clean'));
