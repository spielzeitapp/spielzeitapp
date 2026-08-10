-- PLATZ.6 Staging seed (NUR acbaecjzoabafbsjrzvr).
-- Verifizierte IDs — keine Namensannahmen für NSG:
-- Club NSG Gölsental: 9c7a8741-6e73-42d5-88d8-46ce5217e8cd
-- Venue Rohrbach:     ec1ba01f-cc58-4c91-b524-463b510ca339
-- Venue St.Veit:      ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c
-- U12 team_season:    5dd421cd-b47f-4889-8867-9bc1fa451c09
--
-- Idempotent. Keine neuen Venues/Fields. Keine erfundenen USC-Entitäten.
-- USC nur bei exaktem Club-Namen 'USC Rohrbach' und vorhandenen Teams.

DO $$
DECLARE
  v_nsg uuid := '9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
  v_rohrbach uuid := 'ec1ba01f-cc58-4c91-b524-463b510ca339';
  v_stveit uuid := 'ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c';
  v_u12 uuid := '5dd421cd-b47f-4889-8867-9bc1fa451c09';
  v_usc uuid;
  v_usc_count integer;
  v_ts uuid;
  r_team record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = v_nsg) THEN
    RAISE EXCEPTION 'Preflight: NSG Club fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_rohrbach AND club_id = v_nsg) THEN
    RAISE EXCEPTION 'Preflight: Rohrbach Venue/Club mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_stveit AND club_id = v_nsg) THEN
    RAISE EXCEPTION 'Preflight: St.Veit Venue/Club mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_seasons ts
    JOIN public.teams t ON t.id = ts.team_id
    WHERE ts.id = v_u12 AND t.club_id = v_nsg
  ) THEN
    RAISE EXCEPTION 'Preflight: U12 team_season/Club mismatch';
  END IF;

  -- U12: Rohrbach training + home_match; St.Veit nur training
  INSERT INTO public.team_season_training_venues (team_season_id, venue_id, purpose, is_active, sort_order)
  VALUES
    (v_u12, v_rohrbach, 'training', true, 0),
    (v_u12, v_rohrbach, 'home_match', true, 1),
    (v_u12, v_stveit, 'training', true, 10)
  ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
    SET is_active = true,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();

  -- USC Rohrbach: nur bei eindeutigem Namens-Match; sonst SKIP (kein Invent)
  SELECT count(*)::int INTO v_usc_count
  FROM public.clubs c
  WHERE btrim(c.name) = 'USC Rohrbach';

  IF v_usc_count = 0 THEN
    RAISE NOTICE 'PLATZ.6 seed: Club ''USC Rohrbach'' nicht gefunden — USC-Freigaben übersprungen.';
    RETURN;
  END IF;

  IF v_usc_count > 1 THEN
    RAISE EXCEPTION 'PLATZ.6 seed: Ambiguous club name ''USC Rohrbach'' (% Treffer)', v_usc_count;
  END IF;

  SELECT c.id INTO v_usc
  FROM public.clubs c
  WHERE btrim(c.name) = 'USC Rohrbach'
  LIMIT 1;

  FOR r_team IN
    SELECT t.id AS team_id, t.name AS team_name
    FROM public.teams t
    WHERE t.club_id = v_usc
      AND btrim(t.name) IN ('Kampfmannschaft', 'Reserve')
  LOOP
    -- Aktive/draft Saison; bei Mehrdeutigkeit abbrechen
    SELECT count(*)::int INTO v_usc_count
    FROM public.team_seasons ts
    WHERE ts.team_id = r_team.team_id
      AND ts.status IN ('active', 'draft');

    IF v_usc_count = 0 THEN
      RAISE NOTICE 'PLATZ.6 seed: Keine active/draft Saison für USC Team % — Skip.', r_team.team_name;
      CONTINUE;
    END IF;

    IF v_usc_count > 1 THEN
      RAISE EXCEPTION
        'PLATZ.6 seed: Ambiguous team_season for USC team % (% Treffer)',
        r_team.team_name, v_usc_count;
    END IF;

    SELECT ts.id INTO v_ts
    FROM public.team_seasons ts
    WHERE ts.team_id = r_team.team_id
      AND ts.status IN ('active', 'draft')
    LIMIT 1;

    INSERT INTO public.team_season_training_venues (team_season_id, venue_id, purpose, is_active, sort_order)
    VALUES
      (v_ts, v_rohrbach, 'training', true, 0),
      (v_ts, v_rohrbach, 'home_match', true, 1)
    ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
      SET is_active = true,
          sort_order = EXCLUDED.sort_order,
          updated_at = now();

    RAISE NOTICE 'PLATZ.6 seed: Rohrbach training+home_match für USC % (ts %)', r_team.team_name, v_ts;
  END LOOP;
END $$;
