-- Master switch preserves individual choices. Notifications are intentionally separate.
ALTER TABLE public.event_feed_settings
  ADD COLUMN IF NOT EXISTS feed_automation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS result_feed_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.guard_match_feed_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  settings record;
  event_match_id uuid;
  day_enabled boolean;
BEGIN
  IF NEW.post_kind NOT IN ('matchday_auto','matchday_today_auto','matchday_tomorrow_auto',
    'next_match_auto','event_poster_auto','squad_published','lineup_auto','result_auto','live_auto') THEN
    RETURN NEW;
  END IF;
  SELECT e.match_id INTO event_match_id FROM public.events e
    WHERE e.id=NEW.event_id AND (e.kind='match' OR e.type IN ('game','match'));
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO settings FROM public.event_feed_settings WHERE event_id=NEW.event_id;
  IF settings.feed_automation_enabled IS FALSE THEN RETURN NULL; END IF;
  IF NEW.post_kind='squad_published' AND settings.squad_feed_enabled IS FALSE THEN RETURN NULL; END IF;
  IF NEW.post_kind='lineup_auto' AND settings.lineup_feed_enabled IS FALSE THEN RETURN NULL; END IF;
  IF NEW.post_kind='result_auto' AND settings.result_feed_enabled IS FALSE THEN RETURN NULL; END IF;
  IF NEW.post_kind IN ('matchday_auto','matchday_today_auto','matchday_tomorrow_auto','next_match_auto','event_poster_auto') THEN
    SELECT auto_matchday_feed_enabled INTO day_enabled FROM public.matches WHERE id=event_match_id;
    IF day_enabled IS FALSE THEN RETURN NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_match_feed_automation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_match_feed_automation ON public.team_feed_posts;
CREATE TRIGGER guard_match_feed_automation BEFORE INSERT ON public.team_feed_posts
FOR EACH ROW EXECUTE FUNCTION public.guard_match_feed_automation();
SELECT pg_notify('pgrst','reload schema');
