-- STEP 3F: RLS für availability
-- Annahmen:
--   availability.match_id → matches.id
--   availability.player_id → players.id
--   memberships: user_id, team_season_id, role
--   player_guardians: guardian_user_id, player_id
--
-- SELECT: Jeder mit Membership in der team_season darf Availability der Matches
--         dieser team_season sehen.
-- INSERT/UPDATE: trainer/admin für alle Players der team_season;
--               parent nur für Players in player_guardians.

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- SELECT: Mitglieder der team_season dürfen Availability der Matches dieser Saison lesen
CREATE POLICY "availability_select_team_members"
ON public.availability
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
    WHERE m.id = availability.match_id
      AND ms.user_id = auth.uid()
  )
);

-- INSERT: trainer/admin ODER Parent des Spielers
CREATE POLICY "availability_insert_trainer_or_parent"
ON public.availability
FOR INSERT
TO authenticated
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  )
  OR
  (
    EXISTS (
      SELECT 1
      FROM public.player_guardians pg
      WHERE pg.guardian_user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  )
);

-- UPDATE: gleiche Bedingung wie INSERT
CREATE POLICY "availability_update_trainer_or_parent"
ON public.availability
FOR UPDATE
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  )
  OR
  (
    EXISTS (
      SELECT 1
      FROM public.player_guardians pg
      WHERE pg.guardian_user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  )
)
WITH CHECK (true);

-- DELETE: trainer/admin ODER Parent des Spielers
CREATE POLICY "availability_delete_trainer_or_parent"
ON public.availability
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
    WHERE m.id = availability.match_id
      AND ms.user_id = auth.uid()
      AND ms.role IN ('trainer', 'admin')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.player_guardians pg
    WHERE pg.guardian_user_id = auth.uid()
      AND pg.player_id = availability.player_id
  )
);
