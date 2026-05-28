-- Fix: memberships_select_team_season las memberships innerhalb der memberships-Policy
-- erneut lesen → infinite recursion. Prüfung über SECURITY DEFINER Helper.

CREATE OR REPLACE FUNCTION public.is_member_of_team_season(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.team_season_id = p_team_season_id
      AND m.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_member_of_team_season(uuid) IS
  'True if auth.uid() has any membership for p_team_season_id. SECURITY DEFINER avoids memberships RLS recursion in policies.';

REVOKE ALL ON FUNCTION public.is_member_of_team_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of_team_season(uuid) TO authenticated;

DROP POLICY IF EXISTS memberships_select_team_season ON public.memberships;

CREATE POLICY memberships_select_team_season
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_member_of_team_season(team_season_id)
  );

-- profiles_* aus 20260605120000 lesen memberships, aber nicht als memberships-Policy → kein Rekursionsfix nötig.
-- Nach is_member_of_team_season() funktionieren die EXISTS/JOINs wieder korrekt.

SELECT pg_notify('pgrst', 'reload schema');
