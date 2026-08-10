-- PLATZ.5 Staging seed (NUR acbaecjzoabafbsjrzvr).
-- Verifizierte IDs — keine Namensannahmen:
-- Club NSG Gölsental: 9c7a8741-6e73-42d5-88d8-46ce5217e8cd
-- Venue Rohrbach:     ec1ba01f-cc58-4c91-b524-463b510ca339
-- Venue St.Veit:      ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c
-- U12 team_season:    5dd421cd-b47f-4889-8867-9bc1fa451c09
--
-- Idempotent: keine Löschungen. Zonen direkt (ohne ensure_*-Auth), gleiche Geometrie wie PLATZ.4.

CREATE OR REPLACE FUNCTION public._platz5_seed_standard_zones(p_field_id uuid, p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_existing_id uuid;
BEGIN
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
        p_field_id, p_club_id, r.zname, r.blocks, r.sord, true,
        r.code, r.kind, r.rx, r.ry, r.rw, r.rh
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_club uuid := '9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
  v_rohrbach uuid := 'ec1ba01f-cc58-4c91-b524-463b510ca339';
  v_stveit uuid := 'ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c';
  v_u12 uuid := '5dd421cd-b47f-4889-8867-9bc1fa451c09';
  f_rh_main uuid;
  f_rh_train uuid;
  f_sv_main uuid;
  f_sv_side uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = v_club) THEN
    RAISE EXCEPTION 'Preflight: Club fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_rohrbach AND club_id = v_club) THEN
    RAISE EXCEPTION 'Preflight: Rohrbach Venue/Club mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_stveit AND club_id = v_club) THEN
    RAISE EXCEPTION 'Preflight: St.Veit Venue/Club mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_seasons ts
    JOIN public.teams t ON t.id = ts.team_id
    WHERE ts.id = v_u12 AND t.club_id = v_club
  ) THEN
    RAISE EXCEPTION 'Preflight: U12 team_season/Club mismatch';
  END IF;

  SELECT id INTO f_rh_main FROM public.venue_fields
  WHERE venue_id = v_rohrbach AND is_active
    AND lower(btrim(name)) IN ('hauptplatz/matchplatz', 'hauptplatz', 'matchplatz')
  ORDER BY sort_order LIMIT 1;
  IF f_rh_main IS NULL THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_rohrbach, v_club, 'Hauptplatz/Matchplatz', 'main', 0, true)
    RETURNING id INTO f_rh_main;
  END IF;

  SELECT id INTO f_rh_train FROM public.venue_fields
  WHERE venue_id = v_rohrbach AND is_active
    AND lower(btrim(name)) = 'trainingsplatz'
  ORDER BY sort_order LIMIT 1;
  IF f_rh_train IS NULL THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_rohrbach, v_club, 'Trainingsplatz', 'training', 10, true)
    RETURNING id INTO f_rh_train;
  END IF;

  SELECT id INTO f_sv_main FROM public.venue_fields
  WHERE venue_id = v_stveit AND is_active
    AND lower(btrim(name)) = 'hauptplatz'
  ORDER BY sort_order LIMIT 1;
  IF f_sv_main IS NULL THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_stveit, v_club, 'Hauptplatz', 'main', 0, true)
    RETURNING id INTO f_sv_main;
  END IF;

  SELECT id INTO f_sv_side FROM public.venue_fields
  WHERE venue_id = v_stveit AND is_active
    AND lower(btrim(name)) IN ('kleiner nebenplatz', 'nebenplatz')
  ORDER BY sort_order LIMIT 1;
  IF f_sv_side IS NULL THEN
    INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, sort_order, is_active)
    VALUES (v_stveit, v_club, 'Kleiner Nebenplatz', 'small', 10, true)
    RETURNING id INTO f_sv_side;
  END IF;

  PERFORM public._platz5_seed_standard_zones(f_rh_main, v_club);
  PERFORM public._platz5_seed_standard_zones(f_rh_train, v_club);
  PERFORM public._platz5_seed_standard_zones(f_sv_main, v_club);
  PERFORM public._platz5_seed_standard_zones(f_sv_side, v_club);

  INSERT INTO public.team_season_training_venues (team_season_id, venue_id, is_active, sort_order)
  VALUES
    (v_u12, v_rohrbach, true, 0),
    (v_u12, v_stveit, true, 10)
  ON CONFLICT (team_season_id, venue_id) DO UPDATE
    SET is_active = true,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
END $$;

DROP FUNCTION IF EXISTS public._platz5_seed_standard_zones(uuid, uuid);
