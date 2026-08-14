-- STEP 2 Manager: Plätze / Teilflächen / Platzzuordnung zu Events.
-- Additive only. venues = Sportanlagen (bestehend).
-- NICHT auf Production anwenden, bevor Staging verifiziert ist.

-- ---------------------------------------------------------------------------
-- venues: optionale Beschreibung
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.venues.description IS
  'Optionale Freitext-Beschreibung der Sportanlage.';

-- ---------------------------------------------------------------------------
-- venue_fields: Plätze innerhalb einer Sportanlage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  name text NOT NULL,
  field_type text NOT NULL DEFAULT 'other',
  color_hex text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_fields_name_nonempty CHECK (length(btrim(name)) > 0),
  CONSTRAINT venue_fields_type_ok CHECK (
    field_type IN ('main', 'training', 'artificial', 'small', 'hall', 'other')
  ),
  CONSTRAINT venue_fields_color_ok CHECK (
    color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'
  )
);

COMMENT ON TABLE public.venue_fields IS
  'Plätze / Felder einer Sportanlage (Hauptfeld, Halle, …).';

CREATE INDEX IF NOT EXISTS idx_venue_fields_venue_id
  ON public.venue_fields (venue_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_venue_fields_club_id
  ON public.venue_fields (club_id) WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_fields_venue_name_unique
  ON public.venue_fields (venue_id, lower(btrim(name)))
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.set_venue_fields_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_fields_updated_at ON public.venue_fields;
CREATE TRIGGER trg_venue_fields_updated_at
  BEFORE UPDATE ON public.venue_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.set_venue_fields_updated_at();

ALTER TABLE public.venue_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_fields_select ON public.venue_fields;
CREATE POLICY venue_fields_select ON public.venue_fields
  FOR SELECT TO authenticated
  USING (public.can_read_club_venues(club_id));

DROP POLICY IF EXISTS venue_fields_insert ON public.venue_fields;
CREATE POLICY venue_fields_insert ON public.venue_fields
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS venue_fields_update ON public.venue_fields;
CREATE POLICY venue_fields_update ON public.venue_fields
  FOR UPDATE TO authenticated
  USING (public.can_manage_club_venues(club_id))
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS venue_fields_delete ON public.venue_fields;
CREATE POLICY venue_fields_delete ON public.venue_fields
  FOR DELETE TO authenticated
  USING (public.can_manage_club_venues(club_id));

-- ---------------------------------------------------------------------------
-- venue_field_zones: Teilflächen (Hälfte Nord/Süd, …)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_field_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.venue_fields (id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  name text NOT NULL,
  blocks_entire_field boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_field_zones_name_nonempty CHECK (length(btrim(name)) > 0)
);

COMMENT ON TABLE public.venue_field_zones IS
  'Teilflächen eines Platzes. blocks_entire_field=true blockiert alle Zonen.';

CREATE INDEX IF NOT EXISTS idx_venue_field_zones_field_id
  ON public.venue_field_zones (field_id) WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_field_zones_field_name_unique
  ON public.venue_field_zones (field_id, lower(btrim(name)))
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.set_venue_field_zones_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_field_zones_updated_at ON public.venue_field_zones;
CREATE TRIGGER trg_venue_field_zones_updated_at
  BEFORE UPDATE ON public.venue_field_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_venue_field_zones_updated_at();

ALTER TABLE public.venue_field_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_field_zones_select ON public.venue_field_zones;
CREATE POLICY venue_field_zones_select ON public.venue_field_zones
  FOR SELECT TO authenticated
  USING (public.can_read_club_venues(club_id));

DROP POLICY IF EXISTS venue_field_zones_insert ON public.venue_field_zones;
CREATE POLICY venue_field_zones_insert ON public.venue_field_zones
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS venue_field_zones_update ON public.venue_field_zones;
CREATE POLICY venue_field_zones_update ON public.venue_field_zones
  FOR UPDATE TO authenticated
  USING (public.can_manage_club_venues(club_id))
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS venue_field_zones_delete ON public.venue_field_zones;
CREATE POLICY venue_field_zones_delete ON public.venue_field_zones
  FOR DELETE TO authenticated
  USING (public.can_manage_club_venues(club_id));

-- ---------------------------------------------------------------------------
-- event_field_assignments: Platzzuordnung zu bestehendem Event (keine Dublette)
-- zone_id NULL = gesamter Platz (blockiert alle Teilflächen)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_field_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  field_id uuid NOT NULL REFERENCES public.venue_fields (id) ON DELETE RESTRICT,
  zone_id uuid REFERENCES public.venue_field_zones (id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_field_assignments_time_ok CHECK (ends_at > starts_at),
  CONSTRAINT event_field_assignments_event_unique UNIQUE (event_id)
);

COMMENT ON TABLE public.event_field_assignments IS
  'Interne Platzreservierung für ein bestehendes Event. Kein zweiter Termin.';

CREATE INDEX IF NOT EXISTS idx_event_field_assignments_club_time
  ON public.event_field_assignments (club_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_event_field_assignments_field_time
  ON public.event_field_assignments (field_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_event_field_assignments_venue_time
  ON public.event_field_assignments (venue_id, starts_at, ends_at);

CREATE OR REPLACE FUNCTION public.set_event_field_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_field_assignments_updated_at ON public.event_field_assignments;
CREATE TRIGGER trg_event_field_assignments_updated_at
  BEFORE UPDATE ON public.event_field_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_event_field_assignments_updated_at();

ALTER TABLE public.event_field_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_field_assignments_select ON public.event_field_assignments;
CREATE POLICY event_field_assignments_select ON public.event_field_assignments
  FOR SELECT TO authenticated
  USING (public.can_read_club_venues(club_id));

DROP POLICY IF EXISTS event_field_assignments_insert ON public.event_field_assignments;
CREATE POLICY event_field_assignments_insert ON public.event_field_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS event_field_assignments_update ON public.event_field_assignments;
CREATE POLICY event_field_assignments_update ON public.event_field_assignments
  FOR UPDATE TO authenticated
  USING (public.can_manage_club_venues(club_id))
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS event_field_assignments_delete ON public.event_field_assignments;
CREATE POLICY event_field_assignments_delete ON public.event_field_assignments
  FOR DELETE TO authenticated
  USING (public.can_manage_club_venues(club_id));

-- ---------------------------------------------------------------------------
-- Konfliktprüfung (halb-offen: [start, end) — Berührung an Grenze ok)
-- ---------------------------------------------------------------------------
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
DECLARE
  v_blocks_entire boolean := false;
BEGIN
  IF NOT public.can_read_club_venues(p_club_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

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

REVOKE ALL ON FUNCTION public.find_event_field_assignment_conflicts(uuid, uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_event_field_assignment_conflicts(uuid, uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- Trigger: speichern ablehnen bei Konflikt
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
  FROM public.find_event_field_assignment_conflicts(
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

DROP TRIGGER IF EXISTS trg_event_field_assignments_no_conflict ON public.event_field_assignments;
CREATE TRIGGER trg_event_field_assignments_no_conflict
  BEFORE INSERT OR UPDATE ON public.event_field_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_field_assignment_no_conflict();
