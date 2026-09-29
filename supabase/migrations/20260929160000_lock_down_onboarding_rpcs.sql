-- Supabase grants EXECUTE to anon by default, independently of PUBLIC.
-- Keep onboarding RPCs callable only by authenticated users; functions still
-- enforce platform-admin authorization internally.
REVOKE EXECUTE ON FUNCTION public.admin_set_team_season_oefb_table(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_prepare_team_staff_invite(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_mark_team_staff_invite_sent(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_team_staff_invites(uuid) FROM anon;

-- This function is invoked by its auth.users trigger, never through the API.
REVOKE EXECUTE ON FUNCTION public.apply_pending_team_staff_invites() FROM anon, authenticated, service_role;

SELECT pg_notify('pgrst', 'reload schema');
