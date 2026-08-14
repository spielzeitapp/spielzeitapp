-- PLATZ.3: Vereinsweite Platzbelegungs-Sichtbarkeit + Schreibrechte pro Mannschaft.
-- Additive, idempotente Staging-Migration (nicht ungeprüft auf Production anwenden).
--
-- Ziele:
-- 1) Club-Staff sieht begrenzte Termin-Metadaten aller Mannschaften des Vereins (ohne private Notizen).
-- 2) Platzzuordnungen: lesen clubweit; schreiben nur Staff der Event-Mannschaft oder Vereins-Admin.
-- 3) Abgesagte Events: zugehörige Platzzuordnung wird entfernt (Platz wieder frei).
-- 4) Konflikt-RPC liefert verständliche Mannschafts-/Zeit-Hinweise.

-- ---------------------------------------------------------------------------
-- Helpers: Staff der Event-Mannschaft ODER Vereins-Admin (membership.role = admin
-- an irgendeiner Team-Saison desselben Clubs) ODER Platform-Admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_event_field_assignment(p_event_id uuid)
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
      FROM public.events e
      JOIN public.memberships m ON m.team_season_id = e.team_season_id
      WHERE e.id = p_event_id
        AND m.user_id = auth.uid()
        AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.team_seasons ts ON ts.id = e.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      JOIN public.teams t2 ON t2.club_id = t.club_id
      JOIN public.team_seasons ts2 ON ts2.team_id = t2.id
      JOIN public.memberships m2 ON m2.team_season_id = ts2.id
      WHERE e.id = p_event_id
        AND m2.user_id = auth.uid()
        AND lower(m2.role::text) = 'admin'
    );
$$;

COMMENT ON FUNCTION public.can_manage_event_field_assignment(uuid) IS
  'PLATZ.3: True if auth.uid() may create/update/delete the field assignment for this event.';

REVOKE ALL ON FUNCTION public.can_manage_event_field_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_event_field_assignment(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Club-weite Schedule-Events (begrenzte Spalten, ohne notes / Attendance).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_club_facility_schedule_events(
  p_club_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
RETURNS TABLE (
  id uuid,
  team_season_id uuid,
  kind text,
  type text,
  opponent text,
  starts_at timestamptz,
  location text,
  venue_id uuid,
  status text,
  team_name text,
  age_group text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_club_id IS NULL OR p_range_start IS NULL OR p_range_end IS NULL THEN
    RAISE EXCEPTION 'Ungültige Parameter';
  END IF;
  IF p_range_end <= p_range_start THEN
    RAISE EXCEPTION 'Zeitraum ungültig';
  END IF;
  IF NOT public.can_read_club_venues(p_club_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.team_season_id,
    e.kind::text,
    e.type,
    e.opponent,
    e.starts_at,
    e.location,
    e.venue_id,
    e.status::text,
    COALESCE(NULLIF(btrim(ts.display_name), ''), NULLIF(btrim(t.name), ''), 'Mannschaft') AS team_name,
    COALESCE(NULLIF(btrim(ts.age_group), ''), NULLIF(btrim(t.age_group), '')) AS age_group
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  JOIN public.teams t ON t.id = ts.team_id
  WHERE t.club_id = p_club_id
    AND ts.status IN ('active', 'draft')
    AND e.starts_at >= p_range_start
    AND e.starts_at < p_range_end
    AND lower(COALESCE(e.status::text, '')) NOT IN ('canceled', 'cancelled')
  ORDER BY e.starts_at ASC;
END;
$$;

COMMENT ON FUNCTION public.list_club_facility_schedule_events(uuid, timestamptz, timestamptz) IS
  'PLATZ.3: Club-weite Terminliste für Platzbelegung (ohne private Notizen/Anwesenheiten).';

REVOKE ALL ON FUNCTION public.list_club_facility_schedule_events(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_club_facility_schedule_events(uuid, timestamptz, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- Assignment write policies: nur eigene Mannschaft / Vereins-Admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS event_field_assignments_insert ON public.event_field_assignments;
CREATE POLICY event_field_assignments_insert ON public.event_field_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_read_club_venues(club_id)
    AND public.can_manage_event_field_assignment(event_id)
  );

DROP POLICY IF EXISTS event_field_assignments_update ON public.event_field_assignments;
CREATE POLICY event_field_assignments_update ON public.event_field_assignments
  FOR UPDATE TO authenticated
  USING (public.can_manage_event_field_assignment(event_id))
  WITH CHECK (public.can_manage_event_field_assignment(event_id));

DROP POLICY IF EXISTS event_field_assignments_delete ON public.event_field_assignments;
CREATE POLICY event_field_assignments_delete ON public.event_field_assignments
  FOR DELETE TO authenticated
  USING (public.can_manage_event_field_assignment(event_id));

-- ---------------------------------------------------------------------------
-- Konflikte: verständliche Gründe inkl. Mannschaft / Zeitraum
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_event_field_assignment_conflicts_internal(
  p_club_id uuid,
  p_field_id uuid,
  p_zone_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_assignment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  assignment_id uuid,
  event_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  zone_id uuid,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocks_entire boolean := false;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'Ende muss nach Beginn liegen';
  END IF;

  IF p_zone_id IS NULL THEN
    v_blocks_entire := true;
  ELSE
    SELECT z.blocks_entire_field INTO v_blocks_entire
    FROM public.venue_field_zones z
    WHERE z.id = p_zone_id AND z.field_id = p_field_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Teilfläche gehört nicht zu diesem Platz';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.event_id,
    a.starts_at,
    a.ends_at,
    a.zone_id,
    (
      CASE
        WHEN v_blocks_entire OR a.zone_id IS NULL OR COALESCE(z.blocks_entire_field, false)
          THEN 'Gesamtplatz oder blockierende Teilfläche überschneidet sich'
        WHEN a.zone_id IS NOT DISTINCT FROM p_zone_id
          THEN 'Dieselbe Teilfläche ist bereits belegt'
        ELSE 'Überschneidung'
      END
      || ' · '
      || COALESCE(NULLIF(btrim(ts.age_group), ''), NULLIF(btrim(t.age_group), ''), '')
      || CASE
           WHEN COALESCE(NULLIF(btrim(ts.age_group), ''), NULLIF(btrim(t.age_group), '')) IS NOT NULL
             AND COALESCE(NULLIF(btrim(ts.display_name), ''), NULLIF(btrim(t.name), '')) IS NOT NULL
           THEN ' '
           ELSE ''
         END
      || COALESCE(NULLIF(btrim(ts.display_name), ''), NULLIF(btrim(t.name), ''), 'andere Mannschaft')
      || ' · '
      || to_char(timezone('Europe/Vienna', a.starts_at), 'HH24:MI')
      || '–'
      || to_char(timezone('Europe/Vienna', a.ends_at), 'HH24:MI')
      || CASE
           WHEN z.name IS NOT NULL THEN ' · ' || z.name
           ELSE ' · Gesamter Platz'
         END
    )::text AS reason
  FROM public.event_field_assignments a
  LEFT JOIN public.venue_field_zones z ON z.id = a.zone_id
  LEFT JOIN public.events e ON e.id = a.event_id
  LEFT JOIN public.team_seasons ts ON ts.id = e.team_season_id
  LEFT JOIN public.teams t ON t.id = ts.team_id
  WHERE a.club_id = p_club_id
    AND a.field_id = p_field_id
    AND (p_exclude_assignment_id IS NULL OR a.id <> p_exclude_assignment_id)
    AND a.starts_at < p_ends_at
    AND a.ends_at > p_starts_at
    AND (
      v_blocks_entire
      OR a.zone_id IS NULL
      OR COALESCE(z.blocks_entire_field, false)
      OR a.zone_id IS NOT DISTINCT FROM p_zone_id
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Abgesagte Termine blockieren den Platz nicht mehr
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_event_field_assignment_on_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF lower(COALESCE(NEW.status::text, '')) IN ('canceled', 'cancelled')
       AND lower(COALESCE(OLD.status::text, '')) NOT IN ('canceled', 'cancelled') THEN
      DELETE FROM public.event_field_assignments WHERE event_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_sync_field_assignment ON public.events;
CREATE TRIGGER trg_events_sync_field_assignment
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_field_assignment_on_event_change();
