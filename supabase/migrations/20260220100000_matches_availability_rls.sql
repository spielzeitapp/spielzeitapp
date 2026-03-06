-- Matches RLS: Team-Mitglieder dürfen Matches ihrer team_season sehen
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select_team_members" ON public.matches;
CREATE POLICY matches_select_team_members ON public.matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = matches.team_season_id
    )
  );

-- Availability Tabelle (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS availability_unique_match_player
  ON public.availability(match_id, player_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_availability_updated_at ON public.availability;
CREATE TRIGGER trg_availability_updated_at
  BEFORE UPDATE ON public.availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Alte Availability-Policies entfernen (falls mit guardian_user_id)
DROP POLICY IF EXISTS "availability_select_team_members" ON public.availability;
DROP POLICY IF EXISTS "availability_insert_trainer_or_parent" ON public.availability;
DROP POLICY IF EXISTS "availability_update_trainer_or_parent" ON public.availability;
DROP POLICY IF EXISTS "availability_delete_trainer_or_parent" ON public.availability;

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- SELECT: Team-Mitglieder dürfen Availability der Matches ihrer team_season sehen
CREATE POLICY availability_select_team_members ON public.availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: Trainer/Admin für alle
CREATE POLICY availability_write_trainer_admin ON public.availability
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );

-- INSERT: Parent nur eigene Kinder (player_guardians.user_id)
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

-- UPDATE: Parent nur eigene Kinder
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
