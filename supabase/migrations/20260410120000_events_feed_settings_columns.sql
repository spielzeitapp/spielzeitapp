-- Feed-Einstellungen direkt auf events (kein separates INSERT nötig)

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_in_feed boolean NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS feed_template text NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS player_image_url text NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS opponent_logo_url text NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS feed_title text NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS feed_subline text NULL;

-- Bestehende Zeilen aus match_feed_settings übernehmen (falls Tabelle existiert)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_feed_settings') THEN
    UPDATE public.events e
    SET
      show_in_feed = COALESCE(m.is_feed_enabled, e.show_in_feed),
      feed_template = COALESCE(NULLIF(trim(m.template_key), ''), e.feed_template),
      player_image_url = COALESCE(m.player_image_url, e.player_image_url),
      opponent_logo_url = COALESCE(m.opponent_logo_url, e.opponent_logo_url),
      feed_title = COALESCE(m.headline_override, e.feed_title),
      feed_subline = COALESCE(m.subline_override, e.feed_subline)
    FROM public.match_feed_settings m
    WHERE m.event_id = e.id;
  END IF;
END $$;
