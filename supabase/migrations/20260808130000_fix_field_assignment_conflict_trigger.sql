-- STEP 2B fix: Konflikt-Trigger darf nicht an can_read_club_venues scheitern.
-- RLS bleibt die Zugriffskontrolle; die Trigger-Prüfung prüft nur Zeit/Flächen-Konflikte.
-- Additive Korrektur, staging first.

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
    CASE
      WHEN v_blocks_entire OR a.zone_id IS NULL OR COALESCE(z.blocks_entire_field, false)
        THEN 'Gesamtplatz oder blockierende Teilfläche überschneidet sich'
      WHEN a.zone_id IS NOT DISTINCT FROM p_zone_id
        THEN 'Dieselbe Teilfläche ist bereits belegt'
      ELSE 'Überschneidung'
    END AS reason
  FROM public.event_field_assignments a
  LEFT JOIN public.venue_field_zones z ON z.id = a.zone_id
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

REVOKE ALL ON FUNCTION public.find_event_field_assignment_conflicts_internal(uuid, uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
-- Nur für Trigger/interne Nutzung; kein EXECUTE an authenticated.

CREATE OR REPLACE FUNCTION public.find_event_field_assignment_conflicts(
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
BEGIN
  IF NOT public.can_read_club_venues(p_club_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.find_event_field_assignment_conflicts_internal(
    p_club_id,
    p_field_id,
    p_zone_id,
    p_starts_at,
    p_ends_at,
    p_exclude_assignment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_event_field_assignment_no_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c
  FROM public.find_event_field_assignment_conflicts_internal(
    NEW.club_id,
    NEW.field_id,
    NEW.zone_id,
    NEW.starts_at,
    NEW.ends_at,
    NEW.id
  )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Platzkonflikt: % (Event %)', c.reason, c.event_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
