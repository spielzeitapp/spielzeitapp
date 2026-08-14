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
