-- public.matches: INSERT/UPDATE für Trainer/Staff (gleiches Muster wie events_*_trainer_admin)
-- Behebt: "new row violates row-level security policy for table matches"
-- (z. B. upsertMatchForSetup INSERT oder Status-Update aus MatchDetailPage)

DROP POLICY IF EXISTS matches_insert_trainer_staff ON public.matches;
DROP POLICY IF EXISTS "matches_insert_trainer_staff" ON public.matches;

CREATE POLICY matches_insert_trainer_staff ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = matches.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS matches_update_trainer_staff ON public.matches;
DROP POLICY IF EXISTS "matches_update_trainer_staff" ON public.matches;

CREATE POLICY matches_update_trainer_staff ON public.matches
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = matches.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = matches.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );
