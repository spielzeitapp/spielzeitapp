-- STAGING-ORG.1 apply (NUR acbaecjzoabafbsjrzvr)
-- Idempotent. Keine Venue-Duplikate. Keine NSG-Daten ändern.
-- USC Rohrbach existiert bereits; U13 + Saison + Staff + Grants + TEST-Events.

DO $$
DECLARE
  v_project_ok boolean := true;
  v_nsg uuid := '9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
  v_nsg_ts uuid := '5dd421cd-b47f-4889-8867-9bc1fa451c09';
  v_rohrbach uuid := 'ec1ba01f-cc58-4c91-b524-463b510ca339';
  v_stveit uuid := 'ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c';
  v_hauptplatz uuid := '793d2e09-18c6-454f-bae3-3d2af7b94909';
  v_trainingsplatz uuid := '4ac28ccc-8e65-462a-bdf7-96db9a35705a';
  v_usc uuid;
  v_usc_count int;
  v_admin uuid;
  v_team uuid;
  v_ts uuid;
  v_season uuid := '09e88815-bf57-40ac-8bd8-69113b9f65a5'; -- 2026/27
  v_evt uuid;
  v_assign uuid;
  v_free_start timestamptz := timestamptz '2026-08-18 16:00:00+00';
  v_free_end timestamptz := timestamptz '2026-08-18 17:30:00+00';
  v_conflict_start timestamptz := timestamptz '2026-08-17 15:00:00+00'; -- overlaps NSG training 08c2a168
  v_conflict_end timestamptz := timestamptz '2026-08-17 16:30:00+00';
  v_home_start timestamptz := timestamptz '2026-08-19 17:00:00+00';
  v_home_end timestamptz := timestamptz '2026-08-19 18:30:00+00';
  v_away_start timestamptz := timestamptz '2026-08-20 16:00:00+00';
  v_conflicts int;
BEGIN
  -- Preflight: known staging clubs/venues
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = v_nsg) THEN
    RAISE EXCEPTION 'Preflight: NSG fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_rohrbach AND club_id = v_nsg) THEN
    RAISE EXCEPTION 'Preflight: Sportplatz Rohrbach Eigentümer mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_stveit AND club_id = v_nsg) THEN
    RAISE EXCEPTION 'Preflight: St.Veit Eigentümer mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_seasons WHERE id = v_nsg_ts) THEN
    RAISE EXCEPTION 'Preflight: NSG aktive Saison fehlt';
  END IF;

  SELECT count(*)::int INTO v_usc_count
  FROM public.clubs WHERE btrim(name) = 'USC Rohrbach';
  IF v_usc_count = 0 THEN
    RAISE EXCEPTION 'USC Rohrbach fehlt — bitte zuerst über Manager anlegen';
  END IF;
  IF v_usc_count > 1 THEN
    RAISE EXCEPTION 'USC Rohrbach Dublette (% Treffer) — Abbruch', v_usc_count;
  END IF;
  SELECT id INTO v_usc FROM public.clubs WHERE btrim(name) = 'USC Rohrbach' LIMIT 1;

  -- Ensure short_name USC
  UPDATE public.clubs
  SET short_name = coalesce(nullif(btrim(short_name), ''), 'USC'),
      status = 'active',
      archived_at = null
  WHERE id = v_usc;

  -- Platform admin identity (no email hardcode)
  SELECT p.id INTO v_admin
  FROM public.profiles p
  WHERE p.is_admin IS TRUE
  ORDER BY p.id
  LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Kein Plattformadmin in profiles.is_admin';
  END IF;

  -- Team U13 TEST USC Rohrbach
  SELECT id INTO v_team
  FROM public.teams
  WHERE club_id = v_usc AND btrim(name) = 'U13 TEST USC Rohrbach'
  LIMIT 1;
  IF v_team IS NULL THEN
    INSERT INTO public.teams (club_id, name, age_group)
    VALUES (v_usc, 'U13 TEST USC Rohrbach', 'U13')
    RETURNING id INTO v_team;
  ELSE
    UPDATE public.teams SET age_group = coalesce(age_group, 'U13') WHERE id = v_team;
  END IF;

  -- Season 2026/27 for team
  SELECT ts.id INTO v_ts
  FROM public.team_seasons ts
  WHERE ts.team_id = v_team AND ts.season_id = v_season
  LIMIT 1;
  IF v_ts IS NULL THEN
    INSERT INTO public.team_seasons (team_id, season_id, status, display_name, age_group)
    VALUES (v_team, v_season, 'active', 'U13 TEST USC Rohrbach · 2026/27', 'U13')
    RETURNING id INTO v_ts;
  ELSE
    UPDATE public.team_seasons
    SET status = 'active',
        archived_at = null,
        display_name = coalesce(display_name, 'U13 TEST USC Rohrbach · 2026/27'),
        age_group = coalesce(age_group, 'U13')
    WHERE id = v_ts;
  END IF;

  -- TRAINER-MODE.1A: Keine automatische Trainer-Staff-Zuordnung für Plattformadmin auf TEST-USC.
  -- Plattform-/Vereinszugriff erfolgt über user_roles bzw. club_admins, nicht über memberships.

  -- Venue grants: Rohrbach training + home_match only (not St.Veit)
  INSERT INTO public.team_season_training_venues (team_season_id, venue_id, purpose, is_active, sort_order)
  VALUES
    (v_ts, v_rohrbach, 'training', true, 0),
    (v_ts, v_rohrbach, 'home_match', true, 1)
  ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
    SET is_active = true,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();

  -- Ensure St.Veit is NOT granted to USC test season
  DELETE FROM public.team_season_training_venues
  WHERE team_season_id = v_ts AND venue_id = v_stveit;

  -- Keep NSG allowlist for Rohrbach (idempotent, no change to ownership)
  INSERT INTO public.team_season_training_venues (team_season_id, venue_id, purpose, is_active, sort_order)
  VALUES
    (v_nsg_ts, v_rohrbach, 'training', true, 0),
    (v_nsg_ts, v_rohrbach, 'home_match', true, 1)
  ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
    SET is_active = true, updated_at = now();

  -- A) Free U13 training
  SELECT e.id INTO v_evt
  FROM public.events e
  WHERE e.team_season_id = v_ts
    AND e.notes = 'TEST U13 Training – frei'
  LIMIT 1;
  IF v_evt IS NULL THEN
    INSERT INTO public.events (
      team_season_id, kind, type, starts_at, status, notes, venue_id, created_by
    ) VALUES (
      v_ts, 'training', 'training', v_free_start, 'upcoming',
      'TEST U13 Training – frei', v_rohrbach, v_admin
    ) RETURNING id INTO v_evt;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_field_assignments WHERE event_id = v_evt) THEN
    INSERT INTO public.event_field_assignments (
      club_id, event_id, venue_id, field_id, starts_at, ends_at, created_by
    ) VALUES (
      v_nsg, v_evt, v_rohrbach, v_trainingsplatz, v_free_start, v_free_end, v_admin
    );
  END IF;

  -- B) Conflict attempt: create temp event, try assignment, expect conflict, cleanup assignment if somehow created
  SELECT e.id INTO v_evt
  FROM public.events e
  WHERE e.team_season_id = v_ts
    AND e.notes = 'TEST U13 Training – Konflikt'
  LIMIT 1;
  IF v_evt IS NULL THEN
    INSERT INTO public.events (
      team_season_id, kind, type, starts_at, status, notes, venue_id, created_by
    ) VALUES (
      v_ts, 'training', 'training', v_conflict_start, 'canceled',
      'TEST U13 Training – Konflikt', v_rohrbach, v_admin
    ) RETURNING id INTO v_evt;
  ELSE
    UPDATE public.events SET status = 'canceled' WHERE id = v_evt;
  END IF;

  SELECT count(*)::int INTO v_conflicts
  FROM public.find_event_field_assignment_conflicts_internal(
    v_nsg,
    v_trainingsplatz,
    null,
    v_conflict_start,
    v_conflict_end,
    null
  );
  -- Do not insert a lasting conflicting assignment. Store marker note only.
  IF v_conflicts < 1 THEN
    RAISE NOTICE 'STAGING-ORG.1: Konfliktprobe fand keine bestehende NSG-Belegung — bitte manuell prüfen.';
  END IF;
  DELETE FROM public.event_field_assignments WHERE event_id = v_evt;

  -- C) Home match on Hauptplatz
  SELECT e.id INTO v_evt
  FROM public.events e
  WHERE e.team_season_id = v_ts
    AND e.notes = 'TEST U13 Heimspiel'
  LIMIT 1;
  IF v_evt IS NULL THEN
    INSERT INTO public.events (
      team_season_id, kind, type, starts_at, status, notes, venue_id, is_home, opponent, created_by
    ) VALUES (
      v_ts, 'match', 'game', v_home_start, 'upcoming',
      'TEST U13 Heimspiel', v_rohrbach, true, 'TEST Gegner Heim', v_admin
    ) RETURNING id INTO v_evt;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_field_assignments WHERE event_id = v_evt) THEN
    INSERT INTO public.event_field_assignments (
      club_id, event_id, venue_id, field_id, starts_at, ends_at, created_by
    ) VALUES (
      v_nsg, v_evt, v_rohrbach, v_hauptplatz, v_home_start, v_home_end, v_admin
    );
  END IF;

  -- D) Away match — no assignment
  SELECT e.id INTO v_evt
  FROM public.events e
  WHERE e.team_season_id = v_ts
    AND e.notes = 'TEST U13 Auswärtsspiel'
  LIMIT 1;
  IF v_evt IS NULL THEN
    INSERT INTO public.events (
      team_season_id, kind, type, starts_at, status, notes, is_home, opponent, location, created_by
    ) VALUES (
      v_ts, 'match', 'game', v_away_start, 'upcoming',
      'TEST U13 Auswärtsspiel', false, 'TEST Gegner Auswärts', 'Auswärts TEST', v_admin
    ) RETURNING id INTO v_evt;
  END IF;
  DELETE FROM public.event_field_assignments WHERE event_id = v_evt;

  RAISE NOTICE 'STAGING-ORG.1 apply OK usc=% team=% ts=% admin=%', v_usc, v_team, v_ts, v_admin;
END $$;
