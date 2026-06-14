-- Trainingsbeteiligung datenschutzkonform: SELECT nur Staff (alle), Eltern (eigene Kinder), Spieler (eigenes Profil).
-- Ersetzt event_attendance_select_team_members (alle Team-Mitglieder inkl. fremde Eltern).

DROP POLICY IF EXISTS event_attendance_select_team_members ON public.event_attendance;

CREATE POLICY event_attendance_select_staff ON public.event_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_attendance.event_id
        AND public.membership_is_staff_for_team_season(e.team_season_id)
    )
  );

CREATE POLICY event_attendance_select_parent_own_children ON public.event_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = event_attendance.player_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text = 'parent'
    )
  );

CREATE POLICY event_attendance_select_player_self ON public.event_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = event_attendance.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text = 'player'
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
