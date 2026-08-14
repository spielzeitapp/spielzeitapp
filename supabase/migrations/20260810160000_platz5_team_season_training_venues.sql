-- PLATZ.5: Erlaubte Trainingsanlagen je Mannschaftssaison (saisonbezogen).
-- Additive, idempotente Staging-Migration (nicht ungeprüft auf Production).
-- Voraussetzung: PLATZ.3 + PLATZ.4 (20260810120000 / 20260810140000).
--
-- NSG: Eine Mannschaftssaison darf ausdrücklich freigegebene Anlagen nutzen,
-- auch wenn venues.club_id vom Team-Club abweicht. Keine pauschale Club-Freigabe.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_season_training_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL REFERENCES public.team_seasons (id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.team_season_training_venues IS
  'PLATZ.5: Ausdrücklich freigegebene Trainingsanlagen pro Mannschaftssaison (NSG-fähig).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tstv_team_season_venue_unique
  ON public.team_season_training_venues (team_season_id, venue_id);

CREATE INDEX IF NOT EXISTS idx_tstv_team_season_active
  ON public.team_season_training_venues (team_season_id, sort_order)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_tstv_venue_id
  ON public.team_season_training_venues (venue_id)
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.set_team_season_training_venues_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_season_training_venues_updated_at ON public.team_season_training_venues;
CREATE TRIGGER trg_team_season_training_venues_updated_at
  BEFORE UPDATE ON public.team_season_training_venues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_team_season_training_venues_updated_at();

-- ---------------------------------------------------------------------------
-- Rechte-Helfer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_team_season_training_venues(p_team_season_id uuid)
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
      FROM public.memberships m
      WHERE m.team_season_id = p_team_season_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = p_team_season_id
        AND public.can_manage_club_venues(t.club_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team_season_training_venues(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.can_manage_team_staff(p_team_season_id)
    OR EXISTS (
      SELECT 1
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = p_team_season_id
        AND public.can_manage_club_venues(t.club_id)
    );
$$;

COMMENT ON FUNCTION public.can_manage_team_season_training_venues(uuid) IS
  'Jugendleiter/Vereinsadmin bzw. Staff-Admin der Mannschaftssaison dürfen Trainingsanlagen zuweisen.';

REVOKE ALL ON FUNCTION public.can_read_team_season_training_venues(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_team_season_training_venues(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.can_manage_team_season_training_venues(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_team_season_training_venues(uuid) TO authenticated;

-- Venue ist für Training dieser Saison freigegeben?
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
  SELECT EXISTS (
    SELECT 1
    FROM public.team_season_training_venues tv
    WHERE tv.team_season_id = p_team_season_id
      AND tv.venue_id = p_venue_id
      AND tv.is_active
  );
$$;

REVOKE ALL ON FUNCTION public.is_training_venue_allowed_for_team_season(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_training_venue_allowed_for_team_season(uuid, uuid) TO authenticated;

-- Lesbare Venues über Allowlist (NSG-Brücke, ohne pauschale Club-Freigabe)
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
      AND m.user_id = auth.uid()
  )
  OR public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.can_read_venue_via_training_allowlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_venue_via_training_allowlist(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_season_training_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_season_training_venues_select ON public.team_season_training_venues;
CREATE POLICY team_season_training_venues_select ON public.team_season_training_venues
  FOR SELECT TO authenticated
  USING (public.can_read_team_season_training_venues(team_season_id));

DROP POLICY IF EXISTS team_season_training_venues_insert ON public.team_season_training_venues;
CREATE POLICY team_season_training_venues_insert ON public.team_season_training_venues
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team_season_training_venues(team_season_id));

DROP POLICY IF EXISTS team_season_training_venues_update ON public.team_season_training_venues;
CREATE POLICY team_season_training_venues_update ON public.team_season_training_venues
  FOR UPDATE TO authenticated
  USING (public.can_manage_team_season_training_venues(team_season_id))
  WITH CHECK (public.can_manage_team_season_training_venues(team_season_id));

DROP POLICY IF EXISTS team_season_training_venues_delete ON public.team_season_training_venues;
CREATE POLICY team_season_training_venues_delete ON public.team_season_training_venues
  FOR DELETE TO authenticated
  USING (public.can_manage_team_season_training_venues(team_season_id));

-- Venues SELECT erweitern: Allowlist-Brücke (additive Policy)
DROP POLICY IF EXISTS venues_select_via_training_allowlist ON public.venues;
CREATE POLICY venues_select_via_training_allowlist ON public.venues
  FOR SELECT TO authenticated
  USING (public.can_read_venue_via_training_allowlist(id));

-- venue_fields / zones lesbar, wenn Venue über Allowlist lesbar
DROP POLICY IF EXISTS venue_fields_select_via_training_allowlist ON public.venue_fields;
CREATE POLICY venue_fields_select_via_training_allowlist ON public.venue_fields
  FOR SELECT TO authenticated
  USING (public.can_read_venue_via_training_allowlist(venue_id));

DROP POLICY IF EXISTS venue_field_zones_select_via_training_allowlist ON public.venue_field_zones;
CREATE POLICY venue_field_zones_select_via_training_allowlist ON public.venue_field_zones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_fields f
      WHERE f.id = field_id
        AND public.can_read_venue_via_training_allowlist(f.venue_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Serverseitige Validierung bei Platzzuordnung für Trainings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_training_field_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_team_season_id uuid;
  v_field_venue_id uuid;
  v_zone_field_id uuid;
  v_zone_active boolean;
BEGIN
  SELECT lower(COALESCE(e.kind::text, e.type::text, '')), e.team_season_id
  INTO v_kind, v_team_season_id
  FROM public.events e
  WHERE e.id = NEW.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Termin nicht gefunden';
  END IF;

  -- field gehört zur venue
  SELECT f.venue_id INTO v_field_venue_id
  FROM public.venue_fields f
  WHERE f.id = NEW.field_id AND f.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Platz nicht gefunden oder inaktiv';
  END IF;
  IF v_field_venue_id IS DISTINCT FROM NEW.venue_id THEN
    RAISE EXCEPTION 'Der gewählte Platz gehört nicht zur Sportanlage';
  END IF;

  -- zone gehört zum field
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

  -- Nur Trainings: Allowlist erzwingen (Spiele/Turniere unverändert)
  IF v_kind IN ('training') THEN
    IF NOT public.is_training_venue_allowed_for_team_season(v_team_season_id, NEW.venue_id) THEN
      RAISE EXCEPTION 'Diese Sportanlage ist für die Mannschaft nicht als Trainingsanlage freigegeben';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_training_field_assignment ON public.event_field_assignments;
CREATE TRIGGER trg_validate_training_field_assignment
  BEFORE INSERT OR UPDATE ON public.event_field_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_training_field_assignment();

-- events.venue_id bei Training: Allowlist (wenn gesetzt)
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
  IF v_kind = 'training' AND NEW.venue_id IS NOT NULL THEN
    IF NOT public.is_training_venue_allowed_for_team_season(NEW.team_season_id, NEW.venue_id) THEN
      RAISE EXCEPTION 'Diese Sportanlage ist für die Mannschaft nicht als Trainingsanlage freigegeben';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_training_event_venue ON public.events;
CREATE TRIGGER trg_validate_training_event_venue
  BEFORE INSERT OR UPDATE OF venue_id, kind, type, team_season_id ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_training_event_venue();
