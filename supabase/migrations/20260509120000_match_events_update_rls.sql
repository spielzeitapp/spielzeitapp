-- Spielbericht / Live: bestehende match_events-Zeilen bearbeiten (UPDATE).
-- Gleiche Berechtigungslogik wie INSERT/DELETE (Trainer/Staff + Admin).

DROP POLICY IF EXISTS "staff update match_events" ON public.match_events;

CREATE POLICY "staff update match_events" ON public.match_events
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.match_staff_can_write_for_match(match_events.match_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.match_staff_can_write_for_match(match_events.match_id)
  );
