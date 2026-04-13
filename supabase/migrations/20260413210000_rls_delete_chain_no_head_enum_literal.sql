-- Behebt: invalid input value for enum membership_role: "head" im Match-/Event-Delete-Flow.
-- Ursache ist typisch eine RLS-Policy mit ms.role IN (..., 'head'): Postgres castet Literale zum Enum.
-- Abhilfe: nur noch ms.role::text IN ('trainer','co_trainer','head_coach') in SECURITY DEFINER-Hilfen.

CREATE OR REPLACE FUNCTION public.membership_is_staff_for_team_season(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.memberships ms
    WHERE ms.user_id = auth.uid()
      AND ms.team_season_id = p_team_season_id
      AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
  );
$$;

COMMENT ON FUNCTION public.membership_is_staff_for_team_season(uuid) IS
  'Staff fuer team_season (nur Textvergleich der membership_role, kein ungueltiges Enum-Literal).';

GRANT EXECUTE ON FUNCTION public.membership_is_staff_for_team_season(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.match_staff_can_write_for_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
 OR EXISTS (
    SELECT 1
    FROM public.matches m
    INNER JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
    WHERE m.id = p_match_id
      AND ms.user_id = auth.uid()
      AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
  );
$$;

GRANT EXECUTE ON FUNCTION public.match_staff_can_write_for_match(uuid) TO authenticated;

-- ----- Delete-Kette: keine inline ms.role IN (...) mehr fuer Staff-Checks -----

DROP POLICY IF EXISTS matches_delete_staff_admin ON public.matches;
CREATE POLICY matches_delete_staff_admin ON public.matches
  FOR DELETE TO authenticated
  USING (public.membership_is_staff_for_team_season(matches.team_season_id));

DROP POLICY IF EXISTS events_delete_trainer_admin ON public.events;
CREATE POLICY events_delete_trainer_admin ON public.events
  FOR DELETE TO authenticated
  USING (public.membership_is_staff_for_team_season(events.team_season_id));

DROP POLICY IF EXISTS match_events_delete_trainer_admin ON public.match_events;
CREATE POLICY match_events_delete_trainer_admin ON public.match_events
  FOR DELETE TO authenticated
  USING (public.match_staff_can_write_for_match(match_events.match_id));

-- availability: Trainer-Policy (FOR ALL)
DROP POLICY IF EXISTS availability_write_trainer_admin ON public.availability;
CREATE POLICY availability_write_trainer_admin ON public.availability
  FOR ALL TO authenticated
  USING (public.match_staff_can_write_for_match(availability.match_id))
  WITH CHECK (public.match_staff_can_write_for_match(availability.match_id));

-- match_rsvps: Staff-Policies + DELETE fuer Cleanup (vorher ggf. keine DELETE-Policy)
DROP POLICY IF EXISTS match_rsvps_insert_team_staff ON public.match_rsvps;
CREATE POLICY match_rsvps_insert_team_staff ON public.match_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (public.match_staff_can_write_for_match(match_rsvps.match_id));

DROP POLICY IF EXISTS match_rsvps_update_team_staff ON public.match_rsvps;
CREATE POLICY match_rsvps_update_team_staff ON public.match_rsvps
  FOR UPDATE TO authenticated
  USING (public.match_staff_can_write_for_match(match_rsvps.match_id))
  WITH CHECK (public.match_staff_can_write_for_match(match_rsvps.match_id));

DROP POLICY IF EXISTS match_rsvps_delete_team_staff ON public.match_rsvps;
CREATE POLICY match_rsvps_delete_team_staff ON public.match_rsvps
  FOR DELETE TO authenticated
  USING (public.match_staff_can_write_for_match(match_rsvps.match_id));
