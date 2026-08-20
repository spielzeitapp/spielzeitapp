-- =============================================================================
-- PRODUCTION APPLY-ONLY: Trainer + Multi-Venue + Platz-UX
-- Projekt: spielzeitapp-nsg / shxugattqatahckhspwk
--
-- VORAUSSETZUNG: Zuerst prod_trainer_venue_platz_preflight_only.sql ausführen
-- und READY prüfen. Diese Datei enthält KEINE Preflight-SELECTs.
--
-- Inhalt: BEGIN … COMMIT (Schema + Field/Zone-Seed + Grants + Postflight)
-- Bei Fehler: vollständiger Rollback.
-- NICHT den alten kombinierten prod_trainer_venue_platz_apply.sql verwenden.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- B. HARTE SQL-GUARDS (keine hart codierten UUIDs)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ts_count int;
  v_rohrbach_count int;
  v_stveit_count int;
  v_rohrbach_fields int;
  v_stveit_fields int;
  v_events_before bigint;
  v_assign_before bigint;
  v_ambiguous_legacy int := 0;
BEGIN
  IF to_regclass('public.venues') IS NULL
     OR to_regclass('public.venue_fields') IS NULL
     OR to_regclass('public.venue_field_zones') IS NULL
     OR to_regclass('public.event_field_assignments') IS NULL THEN
    RAISE EXCEPTION 'GUARD: Basis-Venue-Tabellen fehlen (venues/fields/zones/assignments)';
  END IF;

  SELECT count(*)::int INTO v_ts_count
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  JOIN public.seasons s ON s.id = ts.season_id
  WHERE ts.status = 'active'
    AND (
      coalesce(ts.age_group, '') ILIKE 'U12%'
      OR t.name ILIKE '%U12%'
      OR coalesce(ts.display_name, '') ILIKE '%U12%'
    )
    AND (
      c.name ILIKE '%Rohrbach%'
      OR c.name ILIKE '%NSG%'
      OR c.name ILIKE '%SPG%'
      OR c.name ILIKE '%Gölsental%'
      OR c.name ILIKE '%Goelsental%'
    )
    AND (
      s.name ILIKE '%2026/27%'
      OR s.name ILIKE '%2026%'
      OR s.name ILIKE '%26/27%'
    );

  IF v_ts_count <> 1 THEN
    RAISE EXCEPTION 'GUARD: Aktive U12-Saison 2026/27 nicht eindeutig (Treffer=%)', v_ts_count;
  END IF;

  SELECT count(*)::int INTO v_rohrbach_count
  FROM public.venues v
  WHERE v.name ILIKE '%Rohrbach%'
    AND coalesce(v.is_active, true);

  IF v_rohrbach_count <> 1 THEN
    RAISE EXCEPTION 'GUARD: Sportplatz Rohrbach nicht eindeutig (Treffer=%)', v_rohrbach_count;
  END IF;

  SELECT count(*)::int INTO v_stveit_count
  FROM public.venues v
  WHERE (v.name ILIKE '%St.%Veit%' OR v.name ILIKE '%St Veit%')
    AND coalesce(v.is_active, true);

  IF v_stveit_count <> 1 THEN
    RAISE EXCEPTION 'GUARD: Sportplatz St. Veit nicht eindeutig (Treffer=%)', v_stveit_count;
  END IF;

  SELECT count(*)::int INTO v_rohrbach_fields
  FROM public.venue_fields vf
  JOIN public.venues v ON v.id = vf.venue_id
  WHERE v.name ILIKE '%Rohrbach%'
    AND vf.is_active IS TRUE;

  SELECT count(*)::int INTO v_stveit_fields
  FROM public.venue_fields vf
  JOIN public.venues v ON v.id = vf.venue_id
  WHERE (v.name ILIKE '%St.%Veit%' OR v.name ILIKE '%St Veit%')
    AND vf.is_active IS TRUE;

  RAISE NOTICE 'GUARD INFO: Rohrbach aktive Fields vor Seed=%; St.Veit=% (Seed folgt nach Schema)',
    v_rohrbach_fields, v_stveit_fields;

  IF to_regclass('public.team_venues') IS NOT NULL THEN
    SELECT count(*)::int INTO v_ambiguous_legacy
    FROM (
      SELECT tv.team_id
      FROM public.team_venues tv
      WHERE tv.team_id IS NOT NULL
      GROUP BY tv.team_id
      HAVING (
        SELECT count(*) FROM public.team_seasons ts
        WHERE ts.team_id = tv.team_id AND ts.status = 'active'
      ) > 1
    ) amb;
    IF v_ambiguous_legacy > 0 THEN
      RAISE EXCEPTION 'GUARD: Legacy team_venues nicht eindeutig (% Teams mit >1 aktiver Saison)', v_ambiguous_legacy;
    END IF;
  END IF;

  SELECT count(*) INTO v_events_before FROM public.events;
  SELECT count(*) INTO v_assign_before FROM public.event_field_assignments;

  PERFORM set_config('app.prod_apply.events_before', v_events_before::text, true);
  PERFORM set_config('app.prod_apply.assign_before', v_assign_before::text, true);

  RAISE NOTICE 'GUARD OK: U12=1, Rohrbach=1, St.Veit=1, fields ok, events=%, assignments=%',
    v_events_before, v_assign_before;
END $$;

-- ---------------------------------------------------------------------------
-- C0. Minimaler Plattformadmin-Alias (ohne Club-Admin-RPCs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'Alias für public.is_admin() – Plattform-/Hauptadmin. Keine Club-Admin-Zuordnung.';

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- C/F. BASISMIGRATIONEN + SICHERHEITSMIGRATIONEN folgen inline
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- C/F INLINE: PLATZ.3 (20260810120000_platz3_club_facility_schedule.sql)
-- ===========================================================================
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

-- ===========================================================================
-- C/F INLINE: PLATZ.4 (20260810140000_platz4_field_zone_geometry.sql)
-- ===========================================================================
-- PLATZ.4: Flexible Platzaufteilung (½/⅓/¼) mit normalisierter Flächengeometrie.
-- Additive, idempotente Staging-Migration (nicht ungeprüft auf Production).
-- Voraussetzung empfohlen: PLATZ.3 (20260810120000) auf Staging zuerst oder mit dieser Datei.
--
-- Modell: Unit-Square [0,1]×[0,1] (x von links, y von oben).
-- Konflikt = Zeit-Overlap (halb-offen) UND Rect-Overlap. Angrenzende Flächen/Zeiten: kein Konflikt.
-- Bestehende named-Zonen ohne Geometrie behalten die alte ID-/blocks_entire-Logik.

-- ---------------------------------------------------------------------------
-- Spalten
-- ---------------------------------------------------------------------------
ALTER TABLE public.venue_field_zones
  ADD COLUMN IF NOT EXISTS zone_code text,
  ADD COLUMN IF NOT EXISTS layout_kind text NOT NULL DEFAULT 'named',
  ADD COLUMN IF NOT EXISTS rect_x numeric,
  ADD COLUMN IF NOT EXISTS rect_y numeric,
  ADD COLUMN IF NOT EXISTS rect_w numeric,
  ADD COLUMN IF NOT EXISTS rect_h numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venue_field_zones_layout_kind_chk'
  ) THEN
    ALTER TABLE public.venue_field_zones
      ADD CONSTRAINT venue_field_zones_layout_kind_chk
      CHECK (layout_kind IN ('named', 'entire', 'half', 'third', 'quarter', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venue_field_zones_rect_chk'
  ) THEN
    ALTER TABLE public.venue_field_zones
      ADD CONSTRAINT venue_field_zones_rect_chk
      CHECK (
        (rect_x IS NULL AND rect_y IS NULL AND rect_w IS NULL AND rect_h IS NULL)
        OR (
          rect_x IS NOT NULL AND rect_y IS NOT NULL AND rect_w IS NOT NULL AND rect_h IS NOT NULL
          AND rect_x >= 0 AND rect_y >= 0 AND rect_w > 0 AND rect_h > 0
          AND rect_x + rect_w <= 1.000001
          AND rect_y + rect_h <= 1.000001
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_field_zones_field_code_unique
  ON public.venue_field_zones (field_id, lower(btrim(zone_code)))
  WHERE is_active AND zone_code IS NOT NULL AND length(btrim(zone_code)) > 0;

ALTER TABLE public.venue_fields
  ADD COLUMN IF NOT EXISTS supported_splits text[] NOT NULL DEFAULT ARRAY['entire','half','third','quarter']::text[];

COMMENT ON COLUMN public.venue_field_zones.zone_code IS
  'Stabiler Code für Standardzonen (entire, half_a, …) — idempotente Seed-Logik.';
COMMENT ON COLUMN public.venue_field_zones.layout_kind IS
  'Aufteilungsart: entire|half|third|quarter|named|custom';
COMMENT ON COLUMN public.venue_field_zones.rect_x IS
  'Normalisierte Spielfeld-Geometrie (Unit-Square), links oben.';

-- ---------------------------------------------------------------------------
-- Standardzonen idempotent anlegen / Geometrie aktualisieren
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_standard_field_zones(p_field_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_upserted integer := 0;
  r record;
  v_existing_id uuid;
BEGIN
  SELECT club_id INTO v_club_id FROM public.venue_fields WHERE id = p_field_id;
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Platz nicht gefunden';
  END IF;
  IF NOT public.can_manage_club_venues(v_club_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('entire',    'Ganzer Platz', 'entire',  true,  0,  0::numeric, 0::numeric, 1::numeric, 1::numeric),
      ('half_a',    'Hälfte A',     'half',    false, 10, 0::numeric, 0::numeric, 0.5::numeric, 1::numeric),
      ('half_b',    'Hälfte B',     'half',    false, 11, 0.5::numeric, 0::numeric, 0.5::numeric, 1::numeric),
      ('third_a',   'Drittel A',    'third',   false, 20, 0::numeric, 0::numeric, (1::numeric/3), 1::numeric),
      ('third_b',   'Drittel B',    'third',   false, 21, (1::numeric/3), 0::numeric, (1::numeric/3), 1::numeric),
      ('third_c',   'Drittel C',    'third',   false, 22, (2::numeric/3), 0::numeric, (1::numeric/3), 1::numeric),
      ('quarter_a', 'Viertel A',    'quarter', false, 30, 0::numeric, 0::numeric, 0.5::numeric, 0.5::numeric),
      ('quarter_b', 'Viertel B',    'quarter', false, 31, 0.5::numeric, 0::numeric, 0.5::numeric, 0.5::numeric),
      ('quarter_c', 'Viertel C',    'quarter', false, 32, 0::numeric, 0.5::numeric, 0.5::numeric, 0.5::numeric),
      ('quarter_d', 'Viertel D',    'quarter', false, 33, 0.5::numeric, 0.5::numeric, 0.5::numeric, 0.5::numeric)
    ) AS t(code, zname, kind, blocks, sord, rx, ry, rw, rh)
  LOOP
    SELECT z.id INTO v_existing_id
    FROM public.venue_field_zones z
    WHERE z.field_id = p_field_id
      AND z.is_active
      AND (
        lower(btrim(COALESCE(z.zone_code, ''))) = lower(r.code)
        OR lower(btrim(z.name)) = lower(r.zname)
      )
    ORDER BY CASE WHEN lower(btrim(COALESCE(z.zone_code, ''))) = lower(r.code) THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.venue_field_zones z
      SET
        name = r.zname,
        zone_code = r.code,
        blocks_entire_field = r.blocks,
        sort_order = r.sord,
        layout_kind = r.kind,
        rect_x = r.rx,
        rect_y = r.ry,
        rect_w = r.rw,
        rect_h = r.rh,
        is_active = true
      WHERE z.id = v_existing_id;
    ELSE
      INSERT INTO public.venue_field_zones (
        field_id, club_id, name, blocks_entire_field, sort_order, is_active,
        zone_code, layout_kind, rect_x, rect_y, rect_w, rect_h
      )
      VALUES (
        p_field_id, v_club_id, r.zname, r.blocks, r.sord, true,
        r.code, r.kind, r.rx, r.ry, r.rw, r.rh
      );
    END IF;

    v_upserted := v_upserted + 1;
  END LOOP;

  RETURN v_upserted;
END;
$$;

COMMENT ON FUNCTION public.ensure_standard_field_zones(uuid) IS
  'PLATZ.4: Legt Standardzonen (Ganz/½/⅓/¼) idempotent an bzw. aktualisiert Geometrie.';

REVOKE ALL ON FUNCTION public.ensure_standard_field_zones(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_standard_field_zones(uuid) TO authenticated;

-- Hilfsfunktion: Rect-Overlap (angrenzend = kein Overlap)
CREATE OR REPLACE FUNCTION public.field_zone_rects_overlap(
  a_x numeric, a_y numeric, a_w numeric, a_h numeric,
  b_x numeric, b_y numeric, b_w numeric, b_h numeric
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT (
    a_x IS NULL OR a_y IS NULL OR a_w IS NULL OR a_h IS NULL
    OR b_x IS NULL OR b_y IS NULL OR b_w IS NULL OR b_h IS NULL
    OR (a_x + a_w) <= b_x
    OR (b_x + b_w) <= a_x
    OR (a_y + a_h) <= b_y
    OR (b_y + b_h) <= a_y
  );
$$;

-- ---------------------------------------------------------------------------
-- Konfliktlogik: räumliche Overlaps zusätzlich zur alten Regel
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
      -- Legacy named zones ohne Geometrie: nur gleiche Zone (bereits oben) bzw. blocks_entire
    );
END;
$$;

-- ===========================================================================
-- C/F INLINE: PLATZ.5 (20260810160000_platz5_team_season_training_venues.sql)
-- ===========================================================================
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

-- ===========================================================================
-- C/F INLINE: PLATZ.5.1 (20260810180000_platz51_rotate_half_third_zones.sql)
-- ===========================================================================
-- PLATZ.5.1: Halb- und Drittelzonen quer (90°) korrigieren.
-- Additive Fix-Migration nur für Staging (nicht ungeprüft auf Production).
-- Erhält Zone-IDs, zone_code, Events und Assignments.
--
-- Ziel (Unit-Square, x links→rechts, y oben→unten):
-- half_a:  y=0,   h=0.5, w=1  (oben)
-- half_b:  y=0.5, h=0.5, w=1  (unten)
-- third_a: y=0,       h=1/3, w=1
-- third_b: y=1/3,     h=1/3, w=1
-- third_c: y=2/3,     h=1/3, w=1
-- entire + quarters unverändert.

-- ---------------------------------------------------------------------------
-- Bestehende Standardzonen (nur per stabilem zone_code) korrigieren
-- ---------------------------------------------------------------------------
UPDATE public.venue_field_zones
SET
  rect_x = 0,
  rect_y = 0,
  rect_w = 1,
  rect_h = 0.5,
  layout_kind = 'half',
  updated_at = now()
WHERE is_active
  AND lower(btrim(zone_code)) = 'half_a';

UPDATE public.venue_field_zones
SET
  rect_x = 0,
  rect_y = 0.5,
  rect_w = 1,
  rect_h = 0.5,
  layout_kind = 'half',
  updated_at = now()
WHERE is_active
  AND lower(btrim(zone_code)) = 'half_b';

UPDATE public.venue_field_zones
SET
  rect_x = 0,
  rect_y = 0,
  rect_w = 1,
  rect_h = (1::numeric / 3),
  layout_kind = 'third',
  updated_at = now()
WHERE is_active
  AND lower(btrim(zone_code)) = 'third_a';

UPDATE public.venue_field_zones
SET
  rect_x = 0,
  rect_y = (1::numeric / 3),
  rect_w = 1,
  rect_h = (1::numeric / 3),
  layout_kind = 'third',
  updated_at = now()
WHERE is_active
  AND lower(btrim(zone_code)) = 'third_b';

UPDATE public.venue_field_zones
SET
  rect_x = 0,
  rect_y = (2::numeric / 3),
  rect_w = 1,
  rect_h = (1::numeric / 3),
  layout_kind = 'third',
  updated_at = now()
WHERE is_active
  AND lower(btrim(zone_code)) = 'third_c';

-- ---------------------------------------------------------------------------
-- ensure_standard_field_zones: künftige Neuanlagen mit korrekter Orientierung
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_standard_field_zones(p_field_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_upserted integer := 0;
  r record;
  v_existing_id uuid;
BEGIN
  SELECT club_id INTO v_club_id FROM public.venue_fields WHERE id = p_field_id;
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Platz nicht gefunden';
  END IF;
  IF NOT public.can_manage_club_venues(v_club_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('entire',    'Ganzer Platz', 'entire',  true,  0,  0::numeric, 0::numeric, 1::numeric, 1::numeric),
      ('half_a',    'Hälfte A',     'half',    false, 10, 0::numeric, 0::numeric, 1::numeric, 0.5::numeric),
      ('half_b',    'Hälfte B',     'half',    false, 11, 0::numeric, 0.5::numeric, 1::numeric, 0.5::numeric),
      ('third_a',   'Drittel A',    'third',   false, 20, 0::numeric, 0::numeric, 1::numeric, (1::numeric/3)),
      ('third_b',   'Drittel B',    'third',   false, 21, 0::numeric, (1::numeric/3), 1::numeric, (1::numeric/3)),
      ('third_c',   'Drittel C',    'third',   false, 22, 0::numeric, (2::numeric/3), 1::numeric, (1::numeric/3)),
      ('quarter_a', 'Viertel A',    'quarter', false, 30, 0::numeric, 0::numeric, 0.5::numeric, 0.5::numeric),
      ('quarter_b', 'Viertel B',    'quarter', false, 31, 0.5::numeric, 0::numeric, 0.5::numeric, 0.5::numeric),
      ('quarter_c', 'Viertel C',    'quarter', false, 32, 0::numeric, 0.5::numeric, 0.5::numeric, 0.5::numeric),
      ('quarter_d', 'Viertel D',    'quarter', false, 33, 0.5::numeric, 0.5::numeric, 0.5::numeric, 0.5::numeric)
    ) AS t(code, zname, kind, blocks, sord, rx, ry, rw, rh)
  LOOP
    SELECT z.id INTO v_existing_id
    FROM public.venue_field_zones z
    WHERE z.field_id = p_field_id
      AND z.is_active
      AND (
        lower(btrim(COALESCE(z.zone_code, ''))) = lower(r.code)
        OR lower(btrim(z.name)) = lower(r.zname)
      )
    ORDER BY CASE WHEN lower(btrim(COALESCE(z.zone_code, ''))) = lower(r.code) THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.venue_field_zones z
      SET
        name = r.zname,
        zone_code = r.code,
        blocks_entire_field = r.blocks,
        sort_order = r.sord,
        layout_kind = r.kind,
        rect_x = r.rx,
        rect_y = r.ry,
        rect_w = r.rw,
        rect_h = r.rh,
        is_active = true
      WHERE z.id = v_existing_id;
    ELSE
      INSERT INTO public.venue_field_zones (
        field_id, club_id, name, blocks_entire_field, sort_order, is_active,
        zone_code, layout_kind, rect_x, rect_y, rect_w, rect_h
      )
      VALUES (
        p_field_id, v_club_id, r.zname, r.blocks, r.sord, true,
        r.code, r.kind, r.rx, r.ry, r.rw, r.rh
      );
    END IF;

    v_upserted := v_upserted + 1;
  END LOOP;

  RETURN v_upserted;
END;
$$;

COMMENT ON FUNCTION public.ensure_standard_field_zones(uuid) IS
  'PLATZ.4/5.1: Standardzonen idempotent; Halb/Drittel quer (oben→unten).';

-- ===========================================================================
-- C/F INLINE: PLATZ.6 (20260810200000_platz6_shared_venue_access.sql)
-- ===========================================================================
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

-- ===========================================================================
-- C/F INLINE: GRANT-MANAGE 18150000 (20260818150000_grant_manage_club_admin_only.sql)
-- ===========================================================================
-- Grant-Verwaltung: nur Plattformadmin oder Vereinsadmin (memberships.role = admin).
-- Trainer/head_coach dürfen Grants nicht mehr per RLS ändern.
-- Keine neue Rollenarchitektur.

CREATE OR REPLACE FUNCTION public.can_manage_team_season_training_venues(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      p_team_season_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships AS m
        JOIN public.team_seasons AS ts ON ts.id = m.team_season_id
        JOIN public.teams AS t ON t.id = ts.team_id
        JOIN public.team_seasons AS target ON target.id = p_team_season_id
        JOIN public.teams AS tt ON tt.id = target.team_id
        WHERE m.user_id = auth.uid()
          AND t.club_id = tt.club_id
          AND lower(m.role::text) = 'admin'
      )
    );
$$;

COMMENT ON FUNCTION public.can_manage_team_season_training_venues(uuid) IS
  'Nur Plattformadmin oder Vereinsadmin dürfen Venue-Grants ändern. Trainer wählen nur vorhandene Grants.';

-- ===========================================================================
-- C/F INLINE: GRANT-CANDIDATES 18160000 (20260818160000_grant_candidates_require_active_field.sql)
-- ===========================================================================
-- MANAGER-VENUE-GRANTS.UI.2
-- Grant-Kandidaten nur für Anlagen mit mindestens einem aktiven Platz.
-- Auswärtsspielorte (0 Fields) bleiben im Katalog, sind aber nicht freigabefähig.
-- Team-Saison-Sichtbarkeit: serverseitige Lese-Rechte + Club-Team-Saison-Liste.

-- ---------------------------------------------------------------------------
-- 1) Venue hat aktiven Platz?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_has_active_field(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_venue_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.venue_fields vf
      WHERE vf.venue_id = p_venue_id
        AND vf.is_active IS TRUE
    );
$$;

COMMENT ON FUNCTION public.venue_has_active_field(uuid) IS
  'True wenn die Anlage mindestens einen aktiven Platz (venue_fields) besitzt.';

REVOKE ALL ON FUNCTION public.venue_has_active_field(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_has_active_field(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Grant-RPC: neue/aktive Freigaben nur für eingerichtete Anlagen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_team_season_venue_grant(
  p_team_season_id uuid,
  p_venue_id uuid,
  p_purpose text,
  p_is_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purpose text := lower(nullif(btrim(coalesce(p_purpose, '')), ''));
  v_id uuid;
  v_owner uuid;
  v_active boolean := coalesce(p_is_active, true);
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_team_season_id IS NULL OR p_venue_id IS NULL OR v_purpose IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF v_purpose NOT IN ('training', 'home_match') THEN
    RAISE EXCEPTION 'Ungültiger Zweck' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_seasons WHERE id = p_team_season_id) THEN
    RAISE EXCEPTION 'Saison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT v.club_id INTO v_owner FROM public.venues v WHERE v.id = p_venue_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Anlage nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_active AND NOT public.venue_has_active_field(p_venue_id) THEN
    RAISE EXCEPTION
      'Anlage ist nicht eingerichtet (kein aktiver Platz). Zuerst einen Platz anlegen.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.team_season_training_venues (
    team_season_id, venue_id, purpose, is_active, sort_order
  )
  VALUES (
    p_team_season_id, p_venue_id, v_purpose, v_active, coalesce(p_sort_order, 0)
  )
  ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'grant_id', v_id,
    'team_season_id', p_team_season_id,
    'venue_id', p_venue_id,
    'purpose', v_purpose,
    'owner_club_id', v_owner,
    'is_active', v_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_team_season_venue_grant(uuid, uuid, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_team_season_venue_grant(uuid, uuid, text, boolean, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Grant-Kandidaten: nur aktive Anlagen mit aktivem Platz
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_grantable_venues()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'club_id', v.club_id,
          'club_name', c.name,
          'is_active', v.is_active
        )
        ORDER BY c.name, v.name
      )
      FROM public.venues v
      JOIN public.clubs c ON c.id = v.club_id
      WHERE coalesce(v.is_active, true)
        AND public.venue_has_active_field(v.id)
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_grantable_venues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_grantable_venues() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Team-Saison-Sichtbarkeit (minimal, serverseitig)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_club_admin_for_club(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_club_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      JOIN public.team_seasons ts ON ts.id = m.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = p_club_id
        AND m.user_id = auth.uid()
        AND lower(m.role::text) = 'admin'
    );
$$;

COMMENT ON FUNCTION public.is_club_admin_for_club(uuid) IS
  'True wenn auth.uid() Vereinsadmin (memberships.role=admin) für mindestens eine Saison des Clubs ist.';

REVOKE ALL ON FUNCTION public.is_club_admin_for_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_admin_for_club(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_team_season(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_team_season_id IS NOT NULL
    AND (
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
          AND public.is_club_admin_for_club(t.club_id)
      )
    );
$$;

COMMENT ON FUNCTION public.can_read_team_season(uuid) IS
  'Plattformadmin, Mitglied der Saison oder Vereinsadmin des Clubs.';

REVOKE ALL ON FUNCTION public.can_read_team_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_team_season(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_club_team_season_ids(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_club_id IS NULL OR auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF public.is_admin() OR public.is_club_admin_for_club(p_club_id) THEN
    RETURN coalesce(
      (
        SELECT jsonb_agg(ts.id ORDER BY t.name, ts.id)
        FROM public.team_seasons ts
        JOIN public.teams t ON t.id = ts.team_id
        WHERE t.club_id = p_club_id
          AND ts.status IN ('active', 'draft')
      ),
      '[]'::jsonb
    );
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(DISTINCT m.team_season_id ORDER BY m.team_season_id)
      FROM public.memberships m
      JOIN public.team_seasons ts ON ts.id = m.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = p_club_id
        AND m.user_id = auth.uid()
        AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'head', 'admin')
        AND ts.status IN ('active', 'draft')
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.list_club_team_season_ids(uuid) IS
  'Sichtbare Team-Saisons eines Clubs: Plattformadmin/Vereinsadmin → alle; Trainer → nur eigene Staff-Saisons.';

REVOKE ALL ON FUNCTION public.list_club_team_season_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_club_team_season_ids(uuid) TO authenticated;

ALTER TABLE public.team_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_seasons_select ON public.team_seasons;
CREATE POLICY team_seasons_select
  ON public.team_seasons
  FOR SELECT
  TO authenticated
  USING (public.can_read_team_season(id));

COMMENT ON POLICY team_seasons_select ON public.team_seasons IS
  'Lesen nur für Plattformadmin, Saison-Mitglied oder Vereinsadmin des Clubs.';

-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- C0b. Fehlende venue_fields Rohrbach / St. Veit (insert-only, idempotent)
-- Staging-Quelle: supabase/queries/platz5_staging_seed.sql
-- Inaktive Namens-Treffer werden NICHT reaktiviert → STOPP
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_rohrbach uuid;
  v_stveit uuid;
  v_club_rh uuid;
  v_club_sv uuid;
  v_created int := 0;
  v_active_n int;
  v_inactive_n int;
BEGIN
  SELECT v.id, v.club_id INTO v_rohrbach, v_club_rh
  FROM public.venues v
  WHERE v.name ILIKE '%Rohrbach%' AND coalesce(v.is_active, true);

  SELECT v.id, v.club_id INTO v_stveit, v_club_sv
  FROM public.venues v
  WHERE (v.name ILIKE '%St.%Veit%' OR v.name ILIKE '%St Veit%')
    AND coalesce(v.is_active, true);

  IF v_rohrbach IS NULL OR v_stveit IS NULL THEN
    RAISE EXCEPTION 'FIELD-SEED: Rohrbach/St.Veit Venue nicht eindeutig';
  END IF;

  -- Rohrbach: Hauptplatz/Matchplatz
  SELECT count(*)::int INTO v_active_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_rohrbach AND vf.is_active IS TRUE
    AND lower(btrim(vf.name)) IN ('hauptplatz/matchplatz', 'hauptplatz', 'matchplatz');
  SELECT count(*)::int INTO v_inactive_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_rohrbach AND vf.is_active IS NOT TRUE
    AND lower(btrim(vf.name)) IN ('hauptplatz/matchplatz', 'hauptplatz', 'matchplatz');
  IF v_active_n > 1 THEN
    RAISE EXCEPTION 'FIELD-SEED: Rohrbach Hauptplatz mehrdeutig aktiv (n=%)', v_active_n;
  ELSIF v_active_n = 0 AND v_inactive_n > 0 THEN
    RAISE EXCEPTION 'FIELD-SEED: Rohrbach Hauptplatz existiert inaktiv – nicht automatisch reaktiviert';
  ELSIF v_active_n = 0 THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_rohrbach, v_club_rh, 'Hauptplatz/Matchplatz', 'main', 0, true);
    v_created := v_created + 1;
  END IF;

  -- Rohrbach: Trainingsplatz
  SELECT count(*)::int INTO v_active_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_rohrbach AND vf.is_active IS TRUE
    AND lower(btrim(vf.name)) = 'trainingsplatz';
  SELECT count(*)::int INTO v_inactive_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_rohrbach AND vf.is_active IS NOT TRUE
    AND lower(btrim(vf.name)) = 'trainingsplatz';
  IF v_active_n > 1 THEN
    RAISE EXCEPTION 'FIELD-SEED: Rohrbach Trainingsplatz mehrdeutig aktiv (n=%)', v_active_n;
  ELSIF v_active_n = 0 AND v_inactive_n > 0 THEN
    RAISE EXCEPTION 'FIELD-SEED: Rohrbach Trainingsplatz existiert inaktiv – nicht automatisch reaktiviert';
  ELSIF v_active_n = 0 THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_rohrbach, v_club_rh, 'Trainingsplatz', 'training', 10, true);
    v_created := v_created + 1;
  END IF;

  -- St. Veit: Hauptplatz
  SELECT count(*)::int INTO v_active_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_stveit AND vf.is_active IS TRUE
    AND lower(btrim(vf.name)) = 'hauptplatz';
  SELECT count(*)::int INTO v_inactive_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_stveit AND vf.is_active IS NOT TRUE
    AND lower(btrim(vf.name)) = 'hauptplatz';
  IF v_active_n > 1 THEN
    RAISE EXCEPTION 'FIELD-SEED: St.Veit Hauptplatz mehrdeutig aktiv (n=%)', v_active_n;
  ELSIF v_active_n = 0 AND v_inactive_n > 0 THEN
    RAISE EXCEPTION 'FIELD-SEED: St.Veit Hauptplatz existiert inaktiv – nicht automatisch reaktiviert';
  ELSIF v_active_n = 0 THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_stveit, v_club_sv, 'Hauptplatz', 'main', 0, true);
    v_created := v_created + 1;
  END IF;

  -- St. Veit: Kleiner Nebenplatz
  SELECT count(*)::int INTO v_active_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_stveit AND vf.is_active IS TRUE
    AND lower(btrim(vf.name)) IN ('kleiner nebenplatz', 'nebenplatz');
  SELECT count(*)::int INTO v_inactive_n FROM public.venue_fields vf
  WHERE vf.venue_id = v_stveit AND vf.is_active IS NOT TRUE
    AND lower(btrim(vf.name)) IN ('kleiner nebenplatz', 'nebenplatz');
  IF v_active_n > 1 THEN
    RAISE EXCEPTION 'FIELD-SEED: St.Veit Nebenplatz mehrdeutig aktiv (n=%)', v_active_n;
  ELSIF v_active_n = 0 AND v_inactive_n > 0 THEN
    RAISE EXCEPTION 'FIELD-SEED: St.Veit Nebenplatz existiert inaktiv – nicht automatisch reaktiviert';
  ELSIF v_active_n = 0 THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_stveit, v_club_sv, 'Kleiner Nebenplatz', 'small', 10, true);
    v_created := v_created + 1;
  END IF;

  IF (
    SELECT count(DISTINCT lower(btrim(vf.name)))::int FROM public.venue_fields vf
    WHERE vf.venue_id = v_rohrbach AND vf.is_active IS TRUE
      AND lower(btrim(vf.name)) IN ('hauptplatz/matchplatz', 'hauptplatz', 'matchplatz', 'trainingsplatz')
  ) < 2 THEN
    RAISE EXCEPTION 'FIELD-SEED: Rohrbach nach Seed ohne 2 erwartete aktive Plätze';
  END IF;
  IF (
    SELECT count(DISTINCT
      CASE
        WHEN lower(btrim(vf.name)) = 'hauptplatz' THEN 'hauptplatz'
        WHEN lower(btrim(vf.name)) IN ('kleiner nebenplatz', 'nebenplatz') THEN 'nebenplatz'
      END
    )::int
    FROM public.venue_fields vf
    WHERE vf.venue_id = v_stveit AND vf.is_active IS TRUE
      AND lower(btrim(vf.name)) IN ('hauptplatz', 'kleiner nebenplatz', 'nebenplatz')
  ) < 2 THEN
    RAISE EXCEPTION 'FIELD-SEED: St.Veit nach Seed ohne 2 erwartete aktive Plätze';
  END IF;

  RAISE NOTICE 'FIELD-SEED OK: % neue Fields angelegt', v_created;
END $$;


-- ---------------------------------------------------------------------------
-- C1. Standardzonen für Rohrbach + St. Veit (INSERT-ONLY, keine Updates)
-- Vorhandene Zonen (per zone_code oder Name) bleiben unverändert.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r_field record;
  r record;
  v_exists boolean;
  v_inserted int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='venue_field_zones' AND column_name='rect_x'
  ) THEN
    RAISE EXCEPTION 'ZONE-SEED: Geometrie-Spalten fehlen nach PLATZ.4';
  END IF;

  FOR r_field IN
    SELECT vf.id AS field_id, vf.club_id
    FROM public.venue_fields vf
    JOIN public.venues v ON v.id = vf.venue_id
    WHERE vf.is_active IS TRUE
      AND (
        v.name ILIKE '%Rohrbach%'
        OR v.name ILIKE '%St.%Veit%'
        OR v.name ILIKE '%St Veit%'
      )
  LOOP
    FOR r IN
      SELECT * FROM (VALUES
        ('entire',    'Ganzer Platz', 'entire',  true,  0,  0::numeric, 0::numeric, 1::numeric, 1::numeric),
        ('half_a',    'Hälfte A',     'half',    false, 10, 0::numeric, 0::numeric, 1::numeric, 0.5::numeric),
        ('half_b',    'Hälfte B',     'half',    false, 11, 0::numeric, 0.5::numeric, 1::numeric, 0.5::numeric),
        ('third_a',   'Drittel A',    'third',   false, 20, 0::numeric, 0::numeric, 1::numeric, (1::numeric/3)),
        ('third_b',   'Drittel B',    'third',   false, 21, 0::numeric, (1::numeric/3), 1::numeric, (1::numeric/3)),
        ('third_c',   'Drittel C',    'third',   false, 22, 0::numeric, (2::numeric/3), 1::numeric, (1::numeric/3)),
        ('quarter_a', 'Viertel A',    'quarter', false, 30, 0::numeric, 0::numeric, 0.5::numeric, 0.5::numeric),
        ('quarter_b', 'Viertel B',    'quarter', false, 31, 0.5::numeric, 0::numeric, 0.5::numeric, 0.5::numeric),
        ('quarter_c', 'Viertel C',    'quarter', false, 32, 0::numeric, 0.5::numeric, 0.5::numeric, 0.5::numeric),
        ('quarter_d', 'Viertel D',    'quarter', false, 33, 0.5::numeric, 0.5::numeric, 0.5::numeric, 0.5::numeric)
      ) AS t(code, zname, kind, blocks, sord, rx, ry, rw, rh)
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM public.venue_field_zones z
        WHERE z.field_id = r_field.field_id
          AND z.is_active
          AND (
            lower(btrim(COALESCE(z.zone_code, ''))) = lower(r.code)
            OR lower(btrim(z.name)) = lower(r.zname)
          )
      ) INTO v_exists;

      IF v_exists THEN
        CONTINUE; -- vorhanden: nicht überschreiben
      END IF;

      INSERT INTO public.venue_field_zones (
        field_id, club_id, name, blocks_entire_field, sort_order, is_active,
        zone_code, layout_kind, rect_x, rect_y, rect_w, rect_h
      )
      VALUES (
        r_field.field_id, r_field.club_id, r.zname, r.blocks, r.sord, true,
        r.code, r.kind, r.rx, r.ry, r.rw, r.rh
      );
      v_inserted := v_inserted + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'ZONE-SEED: % neue Standardzonen eingefügt (bestehende unverändert)', v_inserted;
END $$;

-- D. LEGACY-ÜBERNAHME team_venues → team_season_training_venues
-- - nichts löschen; team_venues bleibt
-- - nur teambezogene Zeilen mit genau einer aktiven Team-Saison
-- - purpose = training (Legacy ohne Zweck)
-- - idempotentes UPSERT
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_migrated int := 0;
  v_skipped int := 0;
  r record;
  v_ts_id uuid;
  v_active_count int;
BEGIN
  IF to_regclass('public.team_venues') IS NULL THEN
    RAISE NOTICE 'LEGACY: team_venues fehlt – Skip.';
    RETURN;
  END IF;

  FOR r IN
    SELECT tv.team_id, tv.venue_id, tv.is_default
    FROM public.team_venues tv
    WHERE tv.team_id IS NOT NULL
  LOOP
    SELECT count(*)::int INTO v_active_count
    FROM public.team_seasons ts
    WHERE ts.team_id = r.team_id AND ts.status = 'active';

    IF v_active_count = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF v_active_count <> 1 THEN
      RAISE EXCEPTION 'LEGACY: Team % hat % aktive Saisons – nicht eindeutig', r.team_id, v_active_count;
    END IF;

    SELECT ts.id INTO v_ts_id
    FROM public.team_seasons ts
    WHERE ts.team_id = r.team_id AND ts.status = 'active'
    LIMIT 1;

    INSERT INTO public.team_season_training_venues (
      team_season_id, venue_id, purpose, is_active, sort_order
    )
    VALUES (
      v_ts_id,
      r.venue_id,
      'training',
      true,
      CASE WHEN r.is_default THEN 0 ELSE 100 END
    )
    ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
      SET is_active = true,
          sort_order = LEAST(public.team_season_training_venues.sort_order, EXCLUDED.sort_order),
          updated_at = now();

    v_migrated := v_migrated + 1;
  END LOOP;

  RAISE NOTICE 'LEGACY: % team_venues→training-Grants übernommen, % übersprungen (keine active Saison)',
    v_migrated, v_skipped;
END $$;

-- ---------------------------------------------------------------------------
-- E. U12-GRANTS: Rohrbach + St. Veit je training + home_match
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ts_id uuid;
  v_rohrbach uuid;
  v_stveit uuid;
BEGIN
  SELECT ts.id INTO v_ts_id
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  JOIN public.seasons s ON s.id = ts.season_id
  WHERE ts.status = 'active'
    AND (
      coalesce(ts.age_group, '') ILIKE 'U12%'
      OR t.name ILIKE '%U12%'
      OR coalesce(ts.display_name, '') ILIKE '%U12%'
    )
    AND (
      c.name ILIKE '%Rohrbach%'
      OR c.name ILIKE '%NSG%'
      OR c.name ILIKE '%SPG%'
      OR c.name ILIKE '%Gölsental%'
      OR c.name ILIKE '%Goelsental%'
    )
    AND (
      s.name ILIKE '%2026/27%'
      OR s.name ILIKE '%2026%'
      OR s.name ILIKE '%26/27%'
    );

  IF v_ts_id IS NULL THEN
    RAISE EXCEPTION 'U12-GRANTS: Team-Saison nicht gefunden';
  END IF;

  SELECT v.id INTO v_rohrbach
  FROM public.venues v
  WHERE v.name ILIKE '%Rohrbach%' AND coalesce(v.is_active, true);

  SELECT v.id INTO v_stveit
  FROM public.venues v
  WHERE (v.name ILIKE '%St.%Veit%' OR v.name ILIKE '%St Veit%')
    AND coalesce(v.is_active, true);

  IF v_rohrbach IS NULL OR v_stveit IS NULL THEN
    RAISE EXCEPTION 'U12-GRANTS: Venue-IDs unvollständig';
  END IF;

  IF NOT public.venue_has_active_field(v_rohrbach) THEN
    RAISE EXCEPTION 'U12-GRANTS: Rohrbach ohne aktiven Platz';
  END IF;
  IF NOT public.venue_has_active_field(v_stveit) THEN
    RAISE EXCEPTION 'U12-GRANTS: St. Veit ohne aktiven Platz';
  END IF;

  INSERT INTO public.team_season_training_venues (team_season_id, venue_id, purpose, is_active, sort_order)
  VALUES
    (v_ts_id, v_rohrbach, 'training', true, 10),
    (v_ts_id, v_rohrbach, 'home_match', true, 11),
    (v_ts_id, v_stveit, 'training', true, 20),
    (v_ts_id, v_stveit, 'home_match', true, 21)
  ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
    SET is_active = true,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();

  RAISE NOTICE 'U12-GRANTS OK: ts=%, rohrbach=%, stveit=% (training+home_match je Venue)',
    v_ts_id, v_rohrbach, v_stveit;
END $$;

-- ---------------------------------------------------------------------------
-- G. POSTFLIGHT (bei Abweichung → Exception → ROLLBACK)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_events_before bigint := current_setting('app.prod_apply.events_before', true)::bigint;
  v_assign_before bigint := current_setting('app.prod_apply.assign_before', true)::bigint;
  v_events_after bigint;
  v_assign_after bigint;
  v_u12_grants int;
  v_ts_id uuid;
BEGIN
  IF to_regclass('public.team_season_training_venues') IS NULL THEN
    RAISE EXCEPTION 'POSTFLIGHT: team_season_training_venues fehlt';
  END IF;

  SELECT count(*) INTO v_events_after FROM public.events;
  SELECT count(*) INTO v_assign_after FROM public.event_field_assignments;

  IF v_events_after <> v_events_before THEN
    RAISE EXCEPTION 'POSTFLIGHT: events verändert (% → %)', v_events_before, v_events_after;
  END IF;
  IF v_assign_after <> v_assign_before THEN
    RAISE EXCEPTION 'POSTFLIGHT: assignments verändert (% → %)', v_assign_before, v_assign_after;
  END IF;

  SELECT ts.id INTO v_ts_id
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  JOIN public.seasons s ON s.id = ts.season_id
  WHERE ts.status = 'active'
    AND (
      coalesce(ts.age_group, '') ILIKE 'U12%'
      OR t.name ILIKE '%U12%'
      OR coalesce(ts.display_name, '') ILIKE '%U12%'
    )
    AND (
      c.name ILIKE '%Rohrbach%'
      OR c.name ILIKE '%NSG%'
      OR c.name ILIKE '%SPG%'
      OR c.name ILIKE '%Gölsental%'
      OR c.name ILIKE '%Goelsental%'
    )
    AND (s.name ILIKE '%2026%' OR s.name ILIKE '%26/27%');

  SELECT count(*)::int INTO v_u12_grants
  FROM public.team_season_training_venues g
  JOIN public.venues v ON v.id = g.venue_id
  WHERE g.team_season_id = v_ts_id
    AND g.is_active
    AND g.purpose IN ('training', 'home_match')
    AND (
      v.name ILIKE '%Rohrbach%'
      OR v.name ILIKE '%St.%Veit%'
      OR v.name ILIKE '%St Veit%'
    );

  IF v_u12_grants <> 4 THEN
    RAISE EXCEPTION 'POSTFLIGHT: erwartet 4 aktive U12-Grants (Rohrbach/St.Veit × training/home_match), gefunden %', v_u12_grants;
  END IF;

  IF (SELECT count(*) FROM public.venues WHERE name ILIKE '%Rohrbach%') <> 1 THEN
    RAISE EXCEPTION 'POSTFLIGHT: Rohrbach-Dublette';
  END IF;
  IF (SELECT count(*) FROM public.venues WHERE name ILIKE '%St.%Veit%' OR name ILIKE '%St Veit%') <> 1 THEN
    RAISE EXCEPTION 'POSTFLIGHT: St.Veit-Dublette';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_shared_venue_occupancy') THEN
    RAISE EXCEPTION 'POSTFLIGHT: list_shared_venue_occupancy fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_venue_purpose_allowed_for_team_season') THEN
    RAISE EXCEPTION 'POSTFLIGHT: is_venue_purpose_allowed_for_team_season fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_set_team_season_venue_grant') THEN
    RAISE EXCEPTION 'POSTFLIGHT: admin_set_team_season_venue_grant fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'venue_has_active_field') THEN
    RAISE EXCEPTION 'POSTFLIGHT: venue_has_active_field fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_manage_team_season_training_venues') THEN
    RAISE EXCEPTION 'POSTFLIGHT: can_manage_team_season_training_venues fehlt';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_assign_club_admin') THEN
    RAISE NOTICE 'POSTFLIGHT INFO: admin_assign_club_admin existiert bereits – dieses Script hat sie nicht angelegt.';
  ELSE
    RAISE NOTICE 'POSTFLIGHT OK: admin_assign_club_admin fehlt (erwartet für diesen Release).';
  END IF;

  RAISE NOTICE 'POSTFLIGHT OK: events=% assignments=% u12_grants=4', v_events_after, v_assign_after;
END $$;

SELECT
  to_regclass('public.team_season_training_venues') IS NOT NULL AS has_grants_table,
  to_regclass('public.team_venues') IS NOT NULL AS has_legacy_team_venues,
  current_setting('app.prod_apply.events_before', true) AS events_before,
  (SELECT count(*)::text FROM public.events) AS events_after,
  current_setting('app.prod_apply.assign_before', true) AS assignments_before,
  (SELECT count(*)::text FROM public.event_field_assignments) AS assignments_after;

SELECT
  g.purpose,
  g.is_active,
  g.sort_order,
  v.name AS venue_name,
  ts.display_name,
  t.name AS team_name,
  c.name AS club_name
FROM public.team_season_training_venues g
JOIN public.venues v ON v.id = g.venue_id
JOIN public.team_seasons ts ON ts.id = g.team_season_id
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
JOIN public.seasons s ON s.id = ts.season_id
WHERE ts.status = 'active'
  AND (
    coalesce(ts.age_group, '') ILIKE 'U12%'
    OR t.name ILIKE '%U12%'
    OR coalesce(ts.display_name, '') ILIKE '%U12%'
  )
  AND (
    c.name ILIKE '%Rohrbach%'
    OR c.name ILIKE '%NSG%'
    OR c.name ILIKE '%SPG%'
    OR c.name ILIKE '%Gölsental%'
    OR c.name ILIKE '%Goelsental%'
  )
  AND (s.name ILIKE '%2026%' OR s.name ILIKE '%26/27%')
  AND g.is_active
ORDER BY v.name, g.purpose;

SELECT
  v.name AS venue_name,
  vf.name AS field_name,
  count(z.id) FILTER (WHERE z.is_active)::int AS active_zones
FROM public.venues v
JOIN public.venue_fields vf ON vf.venue_id = v.id
LEFT JOIN public.venue_field_zones z ON z.field_id = vf.id
WHERE v.name ILIKE '%Rohrbach%'
   OR v.name ILIKE '%St.%Veit%'
   OR v.name ILIKE '%St Veit%'
GROUP BY v.name, vf.name
ORDER BY v.name, vf.name;

SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'list_shared_venue_occupancy',
    'is_venue_purpose_allowed_for_team_season',
    'admin_set_team_season_venue_grant',
    'admin_list_grantable_venues',
    'venue_has_active_field',
    'list_club_team_season_ids',
    'can_manage_team_season_training_venues',
    'is_platform_admin'
  )
ORDER BY proname;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
