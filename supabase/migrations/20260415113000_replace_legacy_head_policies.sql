-- Replace only legacy staff policies that may still evaluate invalid role literal "head".
-- Scope intentionally limited to these policies:
--   availability_delete_staff
--   availability_insert_staff
--   availability_select_staff
--   availability_update_staff
--   events_insert_trainer_admin
--   events_update_trainer_admin
--   event_attendance_write_trainer_admin
-- No frontend/app changes.

-- ---------------------------------------------------------------------------
-- availability_*_staff on public.availability
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS availability_select_staff ON public.availability;
DROP POLICY IF EXISTS "availability_select_staff" ON public.availability;

CREATE POLICY availability_select_staff ON public.availability
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS availability_insert_staff ON public.availability;
DROP POLICY IF EXISTS "availability_insert_staff" ON public.availability;

CREATE POLICY availability_insert_staff ON public.availability
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS availability_update_staff ON public.availability;
DROP POLICY IF EXISTS "availability_update_staff" ON public.availability;

CREATE POLICY availability_update_staff ON public.availability
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS availability_delete_staff ON public.availability;
DROP POLICY IF EXISTS "availability_delete_staff" ON public.availability;

CREATE POLICY availability_delete_staff ON public.availability
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

-- ---------------------------------------------------------------------------
-- events_*_trainer_admin on public.events
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_insert_trainer_admin ON public.events;
DROP POLICY IF EXISTS "events_insert_trainer_admin" ON public.events;

CREATE POLICY events_insert_trainer_admin ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS events_update_trainer_admin ON public.events;
DROP POLICY IF EXISTS "events_update_trainer_admin" ON public.events;

CREATE POLICY events_update_trainer_admin ON public.events
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

-- ---------------------------------------------------------------------------
-- event_attendance_write_trainer_admin on public.event_attendance
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS event_attendance_write_trainer_admin ON public.event_attendance;
DROP POLICY IF EXISTS "event_attendance_write_trainer_admin" ON public.event_attendance;

CREATE POLICY event_attendance_write_trainer_admin ON public.event_attendance
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );
