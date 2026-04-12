-- Matchday Home Feed: optionale Einstellungen pro Spiel-Event
CREATE TABLE IF NOT EXISTS public.match_feed_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  is_feed_enabled boolean NOT NULL DEFAULT false,
  template_key text NOT NULL DEFAULT 'hero_clean'
    CHECK (template_key IN ('hero_red_player_right', 'hero_clean')),
  player_image_url text NULL,
  opponent_logo_url text NULL,
  headline_override text NULL,
  subline_override text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_feed_settings_event_id_key UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_match_feed_settings_event_id ON public.match_feed_settings(event_id);

DROP TRIGGER IF EXISTS trg_match_feed_settings_updated_at ON public.match_feed_settings;
CREATE TRIGGER trg_match_feed_settings_updated_at
  BEFORE UPDATE ON public.match_feed_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.match_feed_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_feed_settings_select_team_members ON public.match_feed_settings;
CREATE POLICY match_feed_settings_select_team_members ON public.match_feed_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = match_feed_settings.event_id
    )
  );

DROP POLICY IF EXISTS match_feed_settings_insert_trainer_admin ON public.match_feed_settings;
CREATE POLICY match_feed_settings_insert_trainer_admin ON public.match_feed_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = match_feed_settings.event_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS match_feed_settings_update_trainer_admin ON public.match_feed_settings;
CREATE POLICY match_feed_settings_update_trainer_admin ON public.match_feed_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = match_feed_settings.event_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = match_feed_settings.event_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS match_feed_settings_delete_trainer_admin ON public.match_feed_settings;
CREATE POLICY match_feed_settings_delete_trainer_admin ON public.match_feed_settings
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = match_feed_settings.event_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );
