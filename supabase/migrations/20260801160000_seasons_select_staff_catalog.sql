-- STEP 6C: seasons catalog SELECT for staff (Prepare-Draft RETURNING / Lookup)
--
-- Root Cause:
-- resolveOrCreateSeasonId does:
--   1) SELECT seasons WHERE name = '2026/27'
--   2) if missing: INSERT ... RETURNING id
-- seasons_select_for_member only allows rows linked to a team_season the user
-- belongs to. After Soft-Lock reset, 2026/27 exists but no team_season for the
-- trainer → SELECT hides the row → INSERT runs → WITH CHECK passes → RETURNING
-- fails under the same SELECT policy → 42501 / RLS → UI "keine Berechtigung".
--
-- Fix: Staff/Admin may read the seasons catalog (names/ids only).
-- Existing member SELECT policy remains (PERMISSIVE OR).

CREATE POLICY seasons_select_staff_catalog
  ON public.seasons
  FOR SELECT
  TO authenticated
  USING (public.is_any_team_staff() OR public.is_admin());

COMMENT ON POLICY seasons_select_staff_catalog ON public.seasons IS
  'Staff/Admin dürfen Saison-Katalog lesen (Prepare Lookup + INSERT RETURNING).';

SELECT pg_notify('pgrst', 'reload schema');
