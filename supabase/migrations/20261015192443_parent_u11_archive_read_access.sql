-- Parents can read the archived U11 sports data of their current team without
-- fabricating historical memberships or granting staff/write permissions.
-- SECURITY INVOKER: only the caller's own RLS-visible memberships are used.
CREATE OR REPLACE FUNCTION public.parent_can_read_u11_archive(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.team_seasons archived
    JOIN public.team_seasons current_season ON current_season.team_id = archived.team_id
    JOIN public.memberships member ON member.team_season_id = current_season.id
    WHERE archived.id = p_team_season_id
      AND (lower(coalesce(archived.status, '')) = 'archived' OR archived.archived_at IS NOT NULL)
      AND upper(trim(coalesce(archived.age_group, ''))) = 'U11'
      AND lower(coalesce(current_season.status, 'active')) = 'active'
      AND current_season.archived_at IS NULL
      AND member.user_id = (SELECT auth.uid())
      AND member.role::text = 'parent'
  );
$$;
REVOKE ALL ON FUNCTION public.parent_can_read_u11_archive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_can_read_u11_archive(uuid) TO authenticated;

CREATE POLICY events_select_family_archive ON public.events
FOR SELECT TO authenticated USING (public.parent_can_read_u11_archive(team_season_id));
CREATE POLICY matches_select_family_archive ON public.matches
FOR SELECT TO authenticated USING (public.parent_can_read_u11_archive(team_season_id));
CREATE POLICY team_season_players_select_family_archive ON public.team_season_players
FOR SELECT TO authenticated USING (public.parent_can_read_u11_archive(team_season_id));
CREATE POLICY seasons_select_family_archive ON public.seasons
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.team_seasons ts
  WHERE ts.season_id = seasons.id AND public.parent_can_read_u11_archive(ts.id)
));
CREATE POLICY tournament_matches_select_family_archive ON public.tournament_matches
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.events e
  WHERE e.id = tournament_matches.tournament_event_id AND public.parent_can_read_u11_archive(e.team_season_id)
));
CREATE POLICY match_lineup_select_family_archive ON public.match_lineup
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.matches m
  WHERE m.id = match_lineup.match_id AND public.parent_can_read_u11_archive(m.team_season_id)
));
CREATE POLICY match_lineup_snapshots_select_family_archive ON public.match_lineup_snapshots
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.matches m
  WHERE m.id = match_lineup_snapshots.match_id AND public.parent_can_read_u11_archive(m.team_season_id)
));
-- Training participation remains limited to the linked child/player.
CREATE POLICY event_attendance_select_family_archive ON public.event_attendance
FOR SELECT TO authenticated USING (
  (EXISTS (SELECT 1 FROM public.player_guardians pg
           WHERE pg.user_id = (SELECT auth.uid()) AND pg.player_id = event_attendance.player_id))
  AND EXISTS (SELECT 1 FROM public.events e
              WHERE e.id = event_attendance.event_id AND public.parent_can_read_u11_archive(e.team_season_id))
);
SELECT pg_notify('pgrst', 'reload schema');
