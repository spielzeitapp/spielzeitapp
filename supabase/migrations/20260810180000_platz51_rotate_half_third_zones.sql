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
