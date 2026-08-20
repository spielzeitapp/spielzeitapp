-- Grant-Verwaltung: nur Plattformadmin oder Vereinsadmin (memberships.role = admin).
-- Trainer/head_coach dürfen Grants nicht mehr per RLS ändern.
-- Keine neue Rollenarchitektur.

CREATE OR REPLACE FUNCTION public.can_manage_team_season_training_venues(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      p_team_season_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships AS m
        JOIN public.team_seasons AS ts ON ts.id = m.team_season_id
        JOIN public.teams AS t ON t.id = ts.team_id
        JOIN public.team_seasons AS target ON target.id = p_team_season_id
        JOIN public.teams AS tt ON tt.id = target.team_id
        WHERE m.user_id = auth.uid()
          AND t.club_id = tt.club_id
          AND lower(m.role::text) = 'admin'
      )
    );
$$;

COMMENT ON FUNCTION public.can_manage_team_season_training_venues(uuid) IS
  'Nur Plattformadmin oder Vereinsadmin dürfen Venue-Grants ändern. Trainer wählen nur vorhandene Grants.';

SELECT pg_notify('pgrst', 'reload schema');
