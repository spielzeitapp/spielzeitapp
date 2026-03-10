-- RSVP permission model: updated_by/source_role on event_attendance, player_users for adult players, RLS for player (self).

-- 1) event_attendance: add updated_by and source_role (who set the RSVP and from which role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_attendance' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.event_attendance ADD COLUMN updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_attendance' AND column_name = 'source_role'
  ) THEN
    ALTER TABLE public.event_attendance ADD COLUMN source_role text NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.event_attendance.updated_by IS 'User who last set this RSVP (auth.uid()).';
COMMENT ON COLUMN public.event_attendance.source_role IS 'Role used when setting: parent | player | trainer.';

-- 2) player_users: direct mapping auth user <-> player (for adult players who RSVP for themselves)
CREATE TABLE IF NOT EXISTS public.player_users (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_users_user_id ON public.player_users(user_id);
CREATE INDEX IF NOT EXISTS idx_player_users_player_id ON public.player_users(player_id);

COMMENT ON TABLE public.player_users IS 'Links auth user to player for self-RSVP (adult players).';

-- 3) RLS player_users: users can only see and manage their own row(s)
ALTER TABLE public.player_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_users_select_own" ON public.player_users;
CREATE POLICY player_users_select_own ON public.player_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "player_users_insert_own" ON public.player_users;
CREATE POLICY player_users_insert_own ON public.player_users
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "player_users_update_own" ON public.player_users;
CREATE POLICY player_users_update_own ON public.player_users
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "player_users_delete_own" ON public.player_users;
CREATE POLICY player_users_delete_own ON public.player_users
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4) event_attendance: allow player (self) to INSERT/UPDATE via player_users
--    Event must belong to same team_season as the player; user must be linked to that player in player_users.
DROP POLICY IF EXISTS "event_attendance_insert_player" ON public.event_attendance;
CREATE POLICY event_attendance_insert_player ON public.event_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_users pu
      JOIN public.players p ON p.id = pu.player_id
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND p.team_season_id = e.team_season_id
    )
  );

DROP POLICY IF EXISTS "event_attendance_update_player" ON public.event_attendance;
CREATE POLICY event_attendance_update_player ON public.event_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_users pu
      JOIN public.players p ON p.id = pu.player_id
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND p.team_season_id = e.team_season_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_users pu
      JOIN public.players p ON p.id = pu.player_id
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND p.team_season_id = e.team_season_id
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
