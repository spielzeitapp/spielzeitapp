-- PLATZ.6: Organisationsübergreifende Venue-Freigabe (Training + Heimspiel)
-- und gemeinsame Minimal-Belegungssicht / feldweite Konflikte.
-- Additive Staging-Migration (nicht ungeprüft auf Production).
-- Voraussetzung: PLATZ.3–5.1.

-- ---------------------------------------------------------------------------
-- 1) Allowlist erweitern: purpose (training | home_match)
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_season_training_venues
  ADD COLUMN IF NOT EXISTS purpose text;

UPDATE public.team_season_training_venues
SET purpose = 'training'
WHERE purpose IS NULL;

ALTER TABLE public.team_season_training_venues
  ALTER COLUMN purpose SET DEFAULT 'training';

ALTER TABLE public.team_season_training_venues
  ALTER COLUMN purpose SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_season_training_venues_purpose_check'
  ) THEN
    ALTER TABLE public.team_season_training_venues
      ADD CONSTRAINT team_season_training_venues_purpose_check
      CHECK (purpose IN ('training', 'home_match'));
  END IF;
END $$;

ALTER TABLE public.team_season_training_venues
  ADD COLUMN IF NOT EXISTS valid_from timestamptz;

ALTER TABLE public.team_season_training_venues
  ADD COLUMN IF NOT EXISTS valid_until timestamptz;

COMMENT ON COLUMN public.team_season_training_venues.purpose IS
  'PLATZ.6: training = Trainingsanlage; home_match = Heimspiel-Anlage.';

COMMENT ON TABLE public.team_season_training_venues IS
  'PLATZ.5/6: Ausdrückliche Venue-Freigabe pro Mannschaftssaison und Zweck (NSG-fähig).';

DROP INDEX IF EXISTS public.idx_tstv_team_season_venue_unique;
DROP INDEX IF EXISTS public.idx_tstv_team_season_venue_purpose_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tstv_team_season_venue_purpose_key'
  ) THEN
    ALTER TABLE public.team_season_training_venues
      ADD CONSTRAINT tstv_team_season_venue_purpose_key
      UNIQUE (team_season_id, venue_id, purpose);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tstv_venue_purpose_active
  ON public.team_season_training_venues (venue_id, purpose)
  WHERE is_active;

-- ---------------------------------------------------------------------------
-- 2) Standard-Heimspielzuordnung (optional, explizit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_season_home_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL REFERENCES public.team_seasons (id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  field_id uuid NOT NULL REFERENCES public.venue_fields (id) ON DELETE RESTRICT,
  zone_id uuid REFERENCES public.venue_field_zones (id) ON DELETE SET NULL,
  lead_minutes integer NOT NULL DEFAULT 0 CHECK (lead_minutes >= 0 AND lead_minutes <= 24 * 60),
  trail_minutes integer NOT NULL DEFAULT 0 CHECK (trail_minutes >= 0 AND trail_minutes <= 24 * 60),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT team_season_home_defaults_one_active UNIQUE (team_season_id)
);

COMMENT ON TABLE public.team_season_home_defaults IS
  'PLATZ.6: Optionale Standard-Heimspielzuordnung (nur bei freigegebener home_match-Anlage).';

CREATE INDEX IF NOT EXISTS idx_tshd_venue_active
  ON public.team_season_home_defaults (venue_id)
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.set_team_season_home_defaults_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_season_home_defaults_updated_at ON public.team_season_home_defaults;
CREATE TRIGGER trg_team_season_home_defaults_updated_at
  BEFORE UPDATE ON public.team_season_home_defaults
  FOR EACH ROW
  EXECUTE FUNCTION public.set_team_season_home_defaults_updated_at();

-- ---------------------------------------------------------------------------
-- 3) Allowlist-Helfer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_venue_purpose_allowed_for_team_season(
  p_team_season_id uuid,
  p_venue_id uuid,
  p_purpose text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_season_training_venues tv
    WHERE tv.team_season_id = p_team_season_id
      AND tv.venue_id = p_venue_id
      AND tv.purpose = lower(btrim(COALESCE(p_purpose, '')))
      AND tv.is_active
      AND (tv.valid_from IS NULL OR tv.valid_from <= now())
      AND (tv.valid_until IS NULL OR tv.valid_until >= now())
  );
$$;

COMMENT ON FUNCTION public.is_venue_purpose_allowed_for_team_season(uuid, uuid, text) IS
  'PLATZ.6: Venue für Zweck training|home_match freigegeben?';

REVOKE ALL ON FUNCTION public.is_venue_purpose_allowed_for_team_season(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_venue_purpose_allowed_for_team_season(uuid, uuid, text) TO authenticated;

-- Backward-compatible: nur Training
CREATE OR REPLACE FUNCTION public.is_training_venue_allowed_for_team_season(
  p_team_season_id uuid,
  p_venue_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_venue_purpose_allowed_for_team_season(p_team_season_id, p_venue_id, 'training');
$$;

CREATE OR REPLACE FUNCTION public.can_read_venue_via_training_allowlist(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_season_training_venues tv
    JOIN public.memberships m ON m.team_season_id = tv.team_season_id
    WHERE tv.venue_id = p_venue_id
      AND tv.is_active
      AND (tv.valid_from IS NULL OR tv.valid_from <= now())
      AND (tv.valid_until IS NULL OR tv.valid_until >= now())
      AND m.user_id = auth.uid()
  )
  OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.can_read_shared_venue_occupancy(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.can_read_venue_via_training_allowlist(p_venue_id)
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = p_venue_id
        AND public.can_read_club_venues(v.club_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_shared_venue_occupancy(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_shared_venue_occupancy(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) RLS home_defaults
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_season_home_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_season_home_defaults_select ON public.team_season_home_defaults;
CREATE POLICY team_season_home_defaults_select ON public.team_season_home_defaults
  FOR SELECT TO authenticated
  USING (public.can_read_team_season_training_venues(team_season_id));

DROP POLICY IF EXISTS team_season_home_defaults_insert ON public.team_season_home_defaults;
CREATE POLICY team_season_home_defaults_insert ON public.team_season_home_defaults
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team_season_training_venues(team_season_id));

DROP POLICY IF EXISTS team_season_home_defaults_update ON public.team_season_home_defaults;
CREATE POLICY team_season_home_defaults_update ON public.team_season_home_defaults
  FOR UPDATE TO authenticated
  USING (public.can_manage_team_season_training_venues(team_season_id))
  WITH CHECK (public.can_manage_team_season_training_venues(team_season_id));

DROP POLICY IF EXISTS team_season_home_defaults_delete ON public.team_season_home_defaults;
CREATE POLICY team_season_home_defaults_delete ON public.team_season_home_defaults
  FOR DELETE TO authenticated
  USING (public.can_manage_team_season_training_venues(team_season_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_season_home_defaults TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Assignments lesbar über Shared-Venue-Allowlist
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS event_field_assignments_select ON public.event_field_assignments;
CREATE POLICY event_field_assignments_select ON public.event_field_assignments
  FOR SELECT TO authenticated
  USING (
    public.can_read_club_venues(club_id)
    OR public.can_read_shared_venue_occupancy(venue_id)
  );

-- ---------------------------------------------------------------------------
-- 6) Validierung: Training + Heimspiel + Auswärts-Schutz
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_training_field_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_is_home boolean;
  v_team_season_id uuid;
  v_field_venue_id uuid;
  v_zone_field_id uuid;
  v_zone_active boolean;
BEGIN
  SELECT lower(COALESCE(e.kind::text, e.type::text, '')), e.is_home, e.team_season_id
  INTO v_kind, v_is_home, v_team_season_id
  FROM public.events e
  WHERE e.id = NEW.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termin nicht gefunden';
  END IF;

  SELECT f.venue_id INTO v_field_venue_id
  FROM public.venue_fields f
  WHERE f.id = NEW.field_id AND f.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Platz nicht gefunden oder inaktiv';
  END IF;
  IF v_field_venue_id IS DISTINCT FROM NEW.venue_id THEN
    RAISE EXCEPTION 'Der gewählte Platz gehört nicht zur Sportanlage';
  END IF;

  IF NEW.zone_id IS NOT NULL THEN
    SELECT z.field_id, z.is_active INTO v_zone_field_id, v_zone_active
    FROM public.venue_field_zones z
    WHERE z.id = NEW.zone_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Teilfläche nicht gefunden';
    END IF;
    IF v_zone_field_id IS DISTINCT FROM NEW.field_id THEN
      RAISE EXCEPTION 'Die Teilfläche gehört nicht zum gewählten Platz';
    END IF;
    IF v_zone_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Die Teilfläche ist nicht aktiv';
    END IF;
  END IF;

  IF v_kind IN ('training') THEN
    IF NOT public.is_venue_purpose_allowed_for_team_season(v_team_season_id, NEW.venue_id, 'training') THEN
      RAISE EXCEPTION 'Diese Sportanlage ist für die Mannschaft nicht als Trainingsanlage freigegeben';
    END IF;
  ELSIF v_kind IN ('match', 'game') THEN
    IF v_is_home IS FALSE THEN
      RAISE EXCEPTION 'Auswärtsspiele erhalten keine lokale Platzzuordnung';
    END IF;
    IF v_is_home IS NULL THEN
      RAISE EXCEPTION 'Heim-/Auswärtsstatus unklar – keine Platzzuordnung ohne klare Heimspiel-Kennzeichnung';
    END IF;
    IF NOT public.is_venue_purpose_allowed_for_team_season(v_team_season_id, NEW.venue_id, 'home_match') THEN
      RAISE EXCEPTION 'Diese Sportanlage ist für die Mannschaft nicht als Heimspiel-Anlage freigegeben';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_training_event_venue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
BEGIN
  v_kind := lower(COALESCE(NEW.kind::text, NEW.type::text, ''));
  IF NEW.venue_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_kind = 'training' THEN
    IF NOT public.is_venue_purpose_allowed_for_team_season(NEW.team_season_id, NEW.venue_id, 'training') THEN
      RAISE EXCEPTION 'Diese Sportanlage ist für die Mannschaft nicht als Trainingsanlage freigegeben';
    END IF;
  ELSIF v_kind IN ('match', 'game') AND NEW.is_home IS TRUE THEN
    IF NOT public.is_venue_purpose_allowed_for_team_season(NEW.team_season_id, NEW.venue_id, 'home_match') THEN
      RAISE EXCEPTION 'Diese Sportanlage ist für die Mannschaft nicht als Heimspiel-Anlage freigegeben';
    END IF;
  ELSIF v_kind IN ('match', 'game') AND NEW.is_home IS FALSE THEN
    -- Auswärts: venue_id darf Freitext-Gegnerort sein; Allowlist nicht erzwingen
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_team_season_home_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field_venue uuid;
  v_zone_field uuid;
BEGIN
  IF NOT public.is_venue_purpose_allowed_for_team_season(NEW.team_season_id, NEW.venue_id, 'home_match') THEN
    RAISE EXCEPTION 'Standard-Heimspielort erfordert freigegebene Heimspiel-Anlage';
  END IF;
  SELECT f.venue_id INTO v_field_venue FROM public.venue_fields f WHERE f.id = NEW.field_id AND f.is_active;
  IF NOT FOUND OR v_field_venue IS DISTINCT FROM NEW.venue_id THEN
    RAISE EXCEPTION 'Standard-Heimfeld gehört nicht zur Anlage';
  END IF;
  IF NEW.zone_id IS NOT NULL THEN
    SELECT z.field_id INTO v_zone_field FROM public.venue_field_zones z WHERE z.id = NEW.zone_id AND z.is_active;
    IF NOT FOUND OR v_zone_field IS DISTINCT FROM NEW.field_id THEN
      RAISE EXCEPTION 'Standard-Zone gehört nicht zum Heimfeld';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_season_home_defaults ON public.team_season_home_defaults;
CREATE TRIGGER trg_validate_team_season_home_defaults
  BEFORE INSERT OR UPDATE ON public.team_season_home_defaults
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_team_season_home_defaults();

-- ---------------------------------------------------------------------------
-- 7) Konflikte feldweit (club-übergreifend auf demselben Platz)
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
  v_rx numeric;
  v_ry numeric;
  v_rw numeric;
  v_rh numeric;
  v_has_geom boolean := false;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'Ende muss nach Beginn liegen';
  END IF;

  IF p_zone_id IS NULL THEN
    v_blocks_entire := true;
    v_rx := 0; v_ry := 0; v_rw := 1; v_rh := 1;
    v_has_geom := true;
  ELSE
    SELECT
      z.blocks_entire_field,
      z.rect_x, z.rect_y, z.rect_w, z.rect_h
    INTO v_blocks_entire, v_rx, v_ry, v_rw, v_rh
    FROM public.venue_field_zones z
    WHERE z.id = p_zone_id AND z.field_id = p_field_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Teilfläche gehört nicht zu diesem Platz';
    END IF;
    IF v_blocks_entire THEN
      v_rx := 0; v_ry := 0; v_rw := 1; v_rh := 1;
      v_has_geom := true;
    ELSIF v_rx IS NOT NULL AND v_rw IS NOT NULL AND v_ry IS NOT NULL AND v_rh IS NOT NULL THEN
      v_has_geom := true;
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
        WHEN v_has_geom
          AND z.rect_x IS NOT NULL AND z.rect_w IS NOT NULL
          AND public.field_zone_rects_overlap(v_rx, v_ry, v_rw, v_rh, z.rect_x, z.rect_y, z.rect_w, z.rect_h)
          THEN 'Flächen überschneiden sich räumlich'
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
  WHERE a.field_id = p_field_id
    -- PLATZ.6: Konflikte über Club-Grenzen hinweg auf demselben physischen Platz
    AND (p_exclude_assignment_id IS NULL OR a.id <> p_exclude_assignment_id)
    AND a.starts_at < p_ends_at
    AND a.ends_at > p_starts_at
    AND (
      v_blocks_entire
      OR a.zone_id IS NULL
      OR COALESCE(z.blocks_entire_field, false)
      OR a.zone_id IS NOT DISTINCT FROM p_zone_id
      OR (
        v_has_geom
        AND (
          COALESCE(z.blocks_entire_field, false)
          OR a.zone_id IS NULL
          OR (
            z.rect_x IS NOT NULL AND z.rect_w IS NOT NULL AND z.rect_y IS NOT NULL AND z.rect_h IS NOT NULL
            AND public.field_zone_rects_overlap(v_rx, v_ry, v_rw, v_rh, z.rect_x, z.rect_y, z.rect_w, z.rect_h)
          )
        )
      )
    );
END;
$$;

-- Öffentliche Konflikt-RPC: Auth für Club ODER Shared-Venue des Fields
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
  v_venue_id uuid;
BEGIN
  SELECT f.venue_id INTO v_venue_id
  FROM public.venue_fields f
  WHERE f.id = p_field_id;
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Platz nicht gefunden';
  END IF;
  IF NOT (
    public.can_read_club_venues(p_club_id)
    OR public.can_read_shared_venue_occupancy(v_venue_id)
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.find_event_field_assignment_conflicts_internal(
    p_club_id, p_field_id, p_zone_id, p_starts_at, p_ends_at, p_exclude_assignment_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) Minimales Shared-Occupancy-DTO (ohne private Mannschaftsdaten)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_shared_venue_occupancy(
  p_venue_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
RETURNS TABLE (
  assignment_id uuid,
  event_id uuid,
  team_season_id uuid,
  team_name text,
  org_name text,
  kind text,
  type text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_id uuid,
  field_id uuid,
  field_name text,
  zone_id uuid,
  zone_name text,
  is_own boolean,
  can_edit boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_venue_id IS NULL OR p_range_start IS NULL OR p_range_end IS NULL THEN
    RAISE EXCEPTION 'Ungültige Parameter';
  END IF;
  IF p_range_end <= p_range_start THEN
    RAISE EXCEPTION 'Zeitraum ungültig';
  END IF;
  IF NOT public.can_read_shared_venue_occupancy(p_venue_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS assignment_id,
    a.event_id,
    e.team_season_id,
    COALESCE(NULLIF(btrim(ts.display_name), ''), NULLIF(btrim(t.name), ''), 'Mannschaft') AS team_name,
    COALESCE(NULLIF(btrim(c.name), ''), 'Organisation') AS org_name,
    e.kind::text,
    e.type,
    e.status::text,
    a.starts_at,
    a.ends_at,
    a.venue_id,
    a.field_id,
    COALESCE(NULLIF(btrim(f.name), ''), 'Platz') AS field_name,
    a.zone_id,
    z.name AS zone_name,
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.team_season_id = e.team_season_id
        AND m.user_id = auth.uid()
    ) AS is_own,
    public.can_manage_event_field_assignment(e.id) AS can_edit
  FROM public.event_field_assignments a
  JOIN public.events e ON e.id = a.event_id
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  JOIN public.venue_fields f ON f.id = a.field_id
  LEFT JOIN public.venue_field_zones z ON z.id = a.zone_id
  WHERE a.venue_id = p_venue_id
    AND a.starts_at < p_range_end
    AND a.ends_at > p_range_start
    AND lower(COALESCE(e.status::text, '')) NOT IN ('canceled', 'cancelled')
  ORDER BY a.starts_at ASC, a.field_id, a.starts_at;
END;
$$;

COMMENT ON FUNCTION public.list_shared_venue_occupancy(uuid, timestamptz, timestamptz) IS
  'PLATZ.6: Minimale planungsrelevante Belegungen einer Anlage (ohne private Mannschaftsdaten).';

REVOKE ALL ON FUNCTION public.list_shared_venue_occupancy(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_shared_venue_occupancy(uuid, timestamptz, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9) Sichere Heimspiel-Standardzuordnung anwenden (kein Raten)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_apply_home_default_assignment(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_def record;
  v_starts timestamptz;
  v_ends timestamptz;
  v_existing uuid;
  v_new_id uuid;
  v_conflict_count integer;
  v_club_id uuid;
BEGIN
  SELECT e.id, e.team_season_id, e.kind, e.type, e.is_home, e.starts_at, e.status
  INTO v_event
  FROM public.events e
  WHERE e.id = p_event_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF lower(COALESCE(v_event.status::text, '')) IN ('canceled', 'cancelled') THEN
    RETURN NULL;
  END IF;
  IF lower(COALESCE(v_event.kind::text, v_event.type::text, '')) NOT IN ('match', 'game') THEN
    RETURN NULL;
  END IF;
  IF v_event.is_home IS DISTINCT FROM TRUE THEN
    RETURN NULL;
  END IF;
  IF NOT public.can_manage_event_field_assignment(p_event_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  SELECT a.id INTO v_existing
  FROM public.event_field_assignments a
  WHERE a.event_id = p_event_id
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT d.* INTO v_def
  FROM public.team_season_home_defaults d
  WHERE d.team_season_id = v_event.team_season_id
    AND d.is_active
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF NOT public.is_venue_purpose_allowed_for_team_season(v_event.team_season_id, v_def.venue_id, 'home_match') THEN
    RETURN NULL;
  END IF;

  v_starts := v_event.starts_at - make_interval(mins => v_def.lead_minutes);
  -- trail_minutes = Nachlauf nach Anstoß; sonst Standard 90 Min ab Anstoß
  IF v_def.trail_minutes > 0 THEN
    v_ends := v_event.starts_at + make_interval(mins => v_def.trail_minutes);
  ELSE
    v_ends := v_event.starts_at + interval '90 minutes';
  END IF;

  SELECT t.club_id INTO v_club_id
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = v_event.team_season_id;
  IF v_club_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::int INTO v_conflict_count
  FROM public.find_event_field_assignment_conflicts_internal(
    v_club_id,
    v_def.field_id,
    v_def.zone_id,
    v_starts,
    v_ends,
    NULL
  );
  IF v_conflict_count > 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.event_field_assignments (
    club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at
  )
  VALUES (
    v_club_id,
    p_event_id,
    v_def.venue_id,
    v_def.field_id,
    v_def.zone_id,
    v_starts,
    v_ends
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT a.id INTO v_existing FROM public.event_field_assignments a WHERE a.event_id = p_event_id LIMIT 1;
    RETURN v_existing;
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.try_apply_home_default_assignment(uuid) IS
  'PLATZ.6: Wendet nur bei eindeutiger Standard-Heimzuordnung ein Assignment an; sonst NULL (kein Raten).';

REVOKE ALL ON FUNCTION public.try_apply_home_default_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_apply_home_default_assignment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.find_event_field_assignment_conflicts(uuid, uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_event_field_assignment_conflicts(uuid, uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.find_event_field_assignment_conflicts_internal(uuid, uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
