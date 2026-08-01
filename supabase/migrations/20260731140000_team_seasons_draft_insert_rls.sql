-- Saison-Entwurf anlegen: RLS für Trainer/Admin des Quell-Teams.
--
-- Root Cause:
-- Memberships hängen an team_season_id. Ein INSERT in team_seasons kann nicht
-- „Membership auf der neuen Zeile“ prüfen (Chicken-Egg). Policies, die
-- m.team_season_id = team_seasons.id erwarten, blockieren jeden Draft-Insert.
--
-- Lösung:
-- SECURITY DEFINER-Helper prüfen Staff über team_id bzw. Quell-Saison.
-- Neue permissive Policies erlauben INSERT/UPDATE nur für Staff des Teams.
-- Keine RLS-Deaktivierung, kein Service-Role, keine Freigabe für alle User.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_team(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_team_id IS NOT NULL
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships AS m
        INNER JOIN public.team_seasons AS ts ON ts.id = m.team_season_id
        WHERE m.user_id = auth.uid()
          AND ts.team_id = p_team_id
          AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    );
$$;

COMMENT ON FUNCTION public.can_manage_team(uuid) IS
  'True if auth.uid() is admin or staff (trainer/co_trainer/head_coach/admin) on any team_season of p_team_id.';

REVOKE ALL ON FUNCTION public.can_manage_team(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_team(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_any_team_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.user_id = auth.uid()
        AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    );
$$;

COMMENT ON FUNCTION public.is_any_team_staff() IS
  'True if auth.uid() is admin or staff on at least one team_season (for seasons catalog INSERT).';

REVOKE ALL ON FUNCTION public.is_any_team_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_any_team_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_team_season_row(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_team(
    (SELECT ts.team_id FROM public.team_seasons AS ts WHERE ts.id = p_team_season_id)
  );
$$;

COMMENT ON FUNCTION public.can_manage_team_season_row(uuid) IS
  'True if auth.uid() may manage the team that owns p_team_season_id.';

REVOKE ALL ON FUNCTION public.can_manage_team_season_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_team_season_row(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.team_season_belongs_to_team(p_team_season_id uuid, p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_seasons AS ts
    WHERE ts.id = p_team_season_id
      AND ts.team_id = p_team_id
  );
$$;

COMMENT ON FUNCTION public.team_season_belongs_to_team(uuid, uuid) IS
  'SECURITY DEFINER: true if team_season belongs to team (avoids RLS recursion in team_seasons policies).';

REVOKE ALL ON FUNCTION public.team_season_belongs_to_team(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_season_belongs_to_team(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seasons: Staff darf neue Saison-Namen (z. B. 2026/27) anlegen
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS seasons_insert_staff ON public.seasons;
CREATE POLICY seasons_insert_staff
  ON public.seasons
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_any_team_staff());

COMMENT ON POLICY seasons_insert_staff ON public.seasons IS
  'Staff/Admin dürfen Saison-Katalogeinträge anlegen (z. B. 2026/27).';

-- ---------------------------------------------------------------------------
-- team_seasons: Draft/Update nur für Staff des gleichen Teams
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS team_seasons_insert_staff_for_team ON public.team_seasons;
CREATE POLICY team_seasons_insert_staff_for_team
  ON public.team_seasons
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_team(team_id)
    AND (
      (
        status = 'draft'
        AND prepared_from_team_season_id IS NOT NULL
        AND public.can_manage_team_staff(prepared_from_team_season_id)
        AND public.team_season_belongs_to_team(prepared_from_team_season_id, team_id)
      )
      OR (status IN ('active', 'draft') AND public.is_admin())
    )
  );

COMMENT ON POLICY team_seasons_insert_staff_for_team ON public.team_seasons IS
  'Trainer/Admin des Quell-Teams dürfen team_seasons-Entwürfe anlegen (gleiche team_id, prepared_from).';

DROP POLICY IF EXISTS team_seasons_update_staff_for_team ON public.team_seasons;
CREATE POLICY team_seasons_update_staff_for_team
  ON public.team_seasons
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_team(team_id))
  WITH CHECK (public.can_manage_team(team_id));

COMMENT ON POLICY team_seasons_update_staff_for_team ON public.team_seasons IS
  'Staff des Teams darf team_seasons aktualisieren (z. B. status archived, age_group).';

-- ---------------------------------------------------------------------------
-- memberships: Staff darf Memberships auf Saisons des eigenen Teams setzen
-- (eigene Zeile bleibt über memberships_insert_own abgedeckt)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS memberships_insert_staff_managed_team ON public.memberships;
CREATE POLICY memberships_insert_staff_managed_team
  ON public.memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_team_season_row(team_season_id));

COMMENT ON POLICY memberships_insert_staff_managed_team ON public.memberships IS
  'Staff darf Memberships für team_seasons des verwalteten Teams anlegen (Saisonwechsel-Kopie).';

DROP POLICY IF EXISTS memberships_update_staff_managed_team ON public.memberships;
CREATE POLICY memberships_update_staff_managed_team
  ON public.memberships
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_team_season_row(team_season_id))
  WITH CHECK (public.can_manage_team_season_row(team_season_id));

COMMENT ON POLICY memberships_update_staff_managed_team ON public.memberships IS
  'Staff darf Memberships für team_seasons des verwalteten Teams aktualisieren.';

SELECT pg_notify('pgrst', 'reload schema');
