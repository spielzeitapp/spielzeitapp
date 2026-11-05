-- Existing platform-admin RLS is sufficient; keep caller permissions in force.
ALTER FUNCTION public.admin_set_team_season_club_table(uuid,text,text) SECURITY INVOKER;
NOTIFY pgrst,'reload schema';
