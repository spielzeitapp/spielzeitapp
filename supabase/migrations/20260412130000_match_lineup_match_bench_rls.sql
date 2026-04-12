-- Lesen: Team-Mitglieder; Schreiben: Trainer/Staff (analog match_events)
-- Ohne Write-Policies schlagen INSERT/DELETE auf match_lineup / match_bench unter RLS fehl.

ALTER TABLE public.match_lineup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_bench ENABLE ROW LEVEL SECURITY;

-- ----- match_lineup -----
DROP POLICY IF EXISTS match_lineup_select_team_members ON public.match_lineup;
CREATE POLICY match_lineup_select_team_members ON public.match_lineup
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_lineup.match_id AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS match_lineup_insert_staff ON public.match_lineup;
CREATE POLICY match_lineup_insert_staff ON public.match_lineup
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_lineup.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS match_lineup_update_staff ON public.match_lineup;
CREATE POLICY match_lineup_update_staff ON public.match_lineup
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_lineup.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_lineup.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS match_lineup_delete_staff ON public.match_lineup;
CREATE POLICY match_lineup_delete_staff ON public.match_lineup
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_lineup.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

-- ----- match_bench -----
DROP POLICY IF EXISTS match_bench_select_team_members ON public.match_bench;
CREATE POLICY match_bench_select_team_members ON public.match_bench
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_bench.match_id AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS match_bench_insert_staff ON public.match_bench;
CREATE POLICY match_bench_insert_staff ON public.match_bench
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_bench.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS match_bench_update_staff ON public.match_bench;
CREATE POLICY match_bench_update_staff ON public.match_bench
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_bench.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_bench.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS match_bench_delete_staff ON public.match_bench;
CREATE POLICY match_bench_delete_staff ON public.match_bench
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_bench.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

-- Anpfiff-Event beim Live-Start: System-Admins dürfen ebenfalls INSERT (profiles.is_admin)
DROP POLICY IF EXISTS match_events_insert_trainer_admin ON public.match_events;
CREATE POLICY match_events_insert_trainer_admin ON public.match_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_events.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'co_trainer', 'head_coach')
    )
  );
