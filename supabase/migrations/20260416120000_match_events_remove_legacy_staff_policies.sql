-- Remove legacy match_events policies that can still reference outdated
-- membership-role checks in the live flow.
-- Keep the live screen on the helper-based role logic only.

DROP POLICY IF EXISTS "staff insert match_events" ON public.match_events;
DROP POLICY IF EXISTS "staff update match_events" ON public.match_events;
DROP POLICY IF EXISTS "staff delete match_events" ON public.match_events;

DROP POLICY IF EXISTS match_events_insert_trainer_admin ON public.match_events;
CREATE POLICY match_events_insert_trainer_admin ON public.match_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.match_staff_can_write_for_match(match_events.match_id)
  );

DROP POLICY IF EXISTS match_events_delete_trainer_admin ON public.match_events;
CREATE POLICY match_events_delete_trainer_admin ON public.match_events
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.match_staff_can_write_for_match(match_events.match_id)
  );
