-- Live-Flow (Anpfiff/Pause/Ende/Tore/Wechsel): match_events INSERT + matches INSERT/UPDATE.
-- Ursache fuer „invalid input value for enum membership_role: head“: veraltete RLS-Policies
-- mit ungueltigem Enum-Literal „head“ (oder aehnlich) in IN-Vergleichen auf memberships.role.
-- Abhilfe: dieselben Hilfsfunktionen wie bei Delete/Lineup — nur ms.role::text IN (...), keine
-- duplizierten EXISTS-Blocks in Policies.

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

-- match_events: INSERT (Live-Ereignisse) — gleicher Staff-Check wie DELETE/RPC
DROP POLICY IF EXISTS match_events_insert_trainer_admin ON public.match_events;
CREATE POLICY match_events_insert_trainer_admin ON public.match_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.match_staff_can_write_for_match(match_events.match_id)
  );

-- matches: INSERT/UPDATE (Status, live_*, scores) — gleicher Staff-Check wie Delete-Kette
DROP POLICY IF EXISTS matches_insert_trainer_staff ON public.matches;
DROP POLICY IF EXISTS "matches_insert_trainer_staff" ON public.matches;
CREATE POLICY matches_insert_trainer_staff ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.membership_is_staff_for_team_season(matches.team_season_id)
  );

DROP POLICY IF EXISTS matches_update_trainer_staff ON public.matches;
DROP POLICY IF EXISTS "matches_update_trainer_staff" ON public.matches;
CREATE POLICY matches_update_trainer_staff ON public.matches
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.membership_is_staff_for_team_season(matches.team_season_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.membership_is_staff_for_team_season(matches.team_season_id)
  );
