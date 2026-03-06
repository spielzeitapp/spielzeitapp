-- Availability table for RSVP (Zu/Absage/Vielleicht) per player per match
CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  note text,
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS availability_unique_match_player
  ON public.availability(match_id, player_id);

CREATE OR REPLACE FUNCTION public.set_availability_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_availability_updated_at ON public.availability;
CREATE TRIGGER trg_availability_updated_at
  BEFORE UPDATE ON public.availability
  FOR EACH ROW EXECUTE FUNCTION public.set_availability_updated_at();

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- (a) Staff (trainer/admin): select all availability for matches of their team
CREATE POLICY availability_select_staff ON public.availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );

-- (b) Parent: select/insert/update/delete only rows where player_id is in player_guardians for auth.uid()
CREATE POLICY availability_select_parent ON public.availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  );

CREATE POLICY availability_insert_parent ON public.availability
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  );

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

CREATE POLICY availability_delete_parent ON public.availability
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = availability.player_id
    )
  );

-- Staff also need insert/update/delete for all team matches
CREATE POLICY availability_insert_staff ON public.availability
  FOR INSERT TO authenticated
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

CREATE POLICY availability_update_staff ON public.availability
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );

CREATE POLICY availability_delete_staff ON public.availability
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = availability.match_id
        AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );
