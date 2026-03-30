-- Availability RLS: Guardian-Zuordnung über public.player_guardians.user_id (= auth.uid()).
-- Idempotent: Policies mit Alias pg und Bedingung pg.user_id / pg.player_id.

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- Aus 20260220100000_matches_availability_rls.sql (Parent nur eigene Kinder)
DROP POLICY IF EXISTS availability_upsert_parent_own_children ON public.availability;
CREATE POLICY availability_upsert_parent_own_children ON public.availability
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role = 'parent'
    )
  );

DROP POLICY IF EXISTS availability_update_parent_own_children ON public.availability;
CREATE POLICY availability_update_parent_own_children ON public.availability
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role = 'parent'
    )
  );

-- Aus 20260220110000_availability_rsvp.sql (Parent-Teil)
DROP POLICY IF EXISTS availability_select_parent ON public.availability;
CREATE POLICY availability_select_parent ON public.availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  );

DROP POLICY IF EXISTS availability_insert_parent ON public.availability;
CREATE POLICY availability_insert_parent ON public.availability
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  );

DROP POLICY IF EXISTS availability_update_parent ON public.availability;
CREATE POLICY availability_update_parent ON public.availability
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  );

DROP POLICY IF EXISTS availability_delete_parent ON public.availability;
CREATE POLICY availability_delete_parent ON public.availability
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
