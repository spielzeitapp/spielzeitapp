-- Optionales Event-Poster für manuelle Feed-Veröffentlichung (Auto-Posting vorbereitet)

CREATE TABLE IF NOT EXISTS public.event_feed_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  poster_url text,
  poster_storage_path text,
  poster_source text NOT NULL DEFAULT 'custom'
    CHECK (poster_source IN ('custom', 'generated', 'none')),
  auto_post_enabled boolean NOT NULL DEFAULT false,
  post_offsets_days jsonb NOT NULL DEFAULT '[]'::jsonb,
  post_mode text NOT NULL DEFAULT 'manual_only'
    CHECK (post_mode IN ('manual_only', 'auto')),
  prefer_custom_poster boolean NOT NULL DEFAULT true,
  caption_override text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_feed_settings_event_id_key UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_feed_settings_event_id ON public.event_feed_settings (event_id);
CREATE INDEX IF NOT EXISTS idx_event_feed_settings_team_season_id ON public.event_feed_settings (team_season_id);

COMMENT ON TABLE public.event_feed_settings IS 'Optionales Event-Poster + Feed-Einstellungen (manuell jetzt, Auto später).';

DROP TRIGGER IF EXISTS trg_event_feed_settings_updated_at ON public.event_feed_settings;
CREATE TRIGGER trg_event_feed_settings_updated_at
  BEFORE UPDATE ON public.event_feed_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.event_feed_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_feed_settings_select_team_members ON public.event_feed_settings;
CREATE POLICY event_feed_settings_select_team_members ON public.event_feed_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.team_season_id = event_feed_settings.team_season_id
        AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS event_feed_settings_insert_trainer_admin ON public.event_feed_settings;
CREATE POLICY event_feed_settings_insert_trainer_admin ON public.event_feed_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = event_feed_settings.event_id
        AND e.team_season_id = event_feed_settings.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS event_feed_settings_update_trainer_admin ON public.event_feed_settings;
CREATE POLICY event_feed_settings_update_trainer_admin ON public.event_feed_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = event_feed_settings.event_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = event_feed_settings.event_id
        AND e.team_season_id = event_feed_settings.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS event_feed_settings_delete_trainer_admin ON public.event_feed_settings;
CREATE POLICY event_feed_settings_delete_trainer_admin ON public.event_feed_settings
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      INNER JOIN public.memberships ms
        ON ms.team_season_id = e.team_season_id AND ms.user_id = auth.uid()
      WHERE e.id = event_feed_settings.event_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_feed_settings TO authenticated;

-- Storage: posters/{team_season_id}/{event_id}/{uuid}.jpg im Bucket team-feed

CREATE OR REPLACE FUNCTION public.team_feed_storage_staff_may_access_path(p_bucket_id text, p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_bucket_id = 'team-feed'
    AND split_part(p_name, '/', 1) IN ('images', 'videos', 'thumbnails', 'posters')
    AND length(trim(split_part(p_name, '/', 2))) > 0
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.user_id = auth.uid()
          AND m.team_season_id::text = split_part(p_name, '/', 2)
          AND m.role IN (
            'trainer'::public.membership_role,
            'co_trainer'::public.membership_role,
            'head_coach'::public.membership_role
          )
      )
    );
$$;

DROP POLICY IF EXISTS "team_feed_storage_select_members" ON storage.objects;
CREATE POLICY "team_feed_storage_select_members"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'team-feed'
    AND split_part(name, '/', 1) IN ('images', 'videos', 'thumbnails', 'posters')
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id::text = split_part(name, '/', 2)
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
