-- Finale Migration: public.events mit vereinheitlichten Spaltennamen
-- Entspricht exakt dem Frontend: kind, type, opponent, location, meeting_at, notes, attendance_mode

-- Abhängigkeit zuerst entfernen
DROP TABLE IF EXISTS public.event_attendance;

DROP TABLE IF EXISTS public.events;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  kind text NULL,
  type text NOT NULL CHECK (type IN ('match', 'training', 'event')),
  opponent text NULL,
  is_home boolean NULL,
  location text NULL,
  starts_at timestamptz NOT NULL,
  meeting_at timestamptz NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished', 'canceled')),
  attendance_mode text NOT NULL DEFAULT 'opt_in' CHECK (attendance_mode IN ('opt_in', 'opt_out')),
  notes text NULL,
  match_id uuid NULL REFERENCES public.matches(id) ON DELETE SET NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_team_season_id ON public.events(team_season_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(type);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);

-- event_attendance (Referenz auf events)
CREATE TABLE public.event_attendance (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  note text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id ON public.event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_player_id ON public.event_attendance(player_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_event_attendance_updated_at ON public.event_attendance;
CREATE TRIGGER trg_event_attendance_updated_at
  BEFORE UPDATE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_team_members" ON public.events;
CREATE POLICY events_select_team_members ON public.events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
    )
  );

DROP POLICY IF EXISTS "events_insert_trainer_admin" ON public.events;
CREATE POLICY events_insert_trainer_admin ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS "events_update_trainer_admin" ON public.events;
CREATE POLICY events_update_trainer_admin ON public.events
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS "events_delete_trainer_admin" ON public.events;
CREATE POLICY events_delete_trainer_admin ON public.events
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = events.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

-- RLS event_attendance
ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_attendance_select_team_members" ON public.event_attendance;
CREATE POLICY event_attendance_select_team_members ON public.event_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_attendance_write_trainer_admin" ON public.event_attendance;
CREATE POLICY event_attendance_write_trainer_admin ON public.event_attendance
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS "event_attendance_insert_parent" ON public.event_attendance;
CREATE POLICY event_attendance_insert_parent ON public.event_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.player_guardians pg WHERE pg.user_id = auth.uid() AND pg.player_id = event_attendance.player_id)
    AND EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id AND ms.user_id = auth.uid() AND ms.role::text = 'parent'
    )
  );

DROP POLICY IF EXISTS "event_attendance_update_parent" ON public.event_attendance;
CREATE POLICY event_attendance_update_parent ON public.event_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.player_guardians pg WHERE pg.user_id = auth.uid() AND pg.player_id = event_attendance.player_id)
    AND EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id AND ms.user_id = auth.uid() AND ms.role::text = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.player_guardians pg WHERE pg.user_id = auth.uid() AND pg.player_id = event_attendance.player_id)
    AND EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id AND ms.user_id = auth.uid() AND ms.role::text = 'parent'
    )
  );
