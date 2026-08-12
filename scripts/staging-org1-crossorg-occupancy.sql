-- STAGING-ORG.1 patch: Cross-Org Konfliktbasis (NSG TEST-Belegung)
-- Additive. Markiert mit TEST. Keine echten Termine ändern.

DO $$
DECLARE
  v_nsg uuid := '9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
  v_nsg_ts uuid := '5dd421cd-b47f-4889-8867-9bc1fa451c09';
  v_rohrbach uuid := 'ec1ba01f-cc58-4c91-b524-463b510ca339';
  v_trainingsplatz uuid := '4ac28ccc-8e65-462a-bdf7-96db9a35705a';
  v_admin uuid;
  v_evt uuid;
  v_start timestamptz := timestamptz '2026-08-21 16:00:00+00';
  v_end timestamptz := timestamptz '2026-08-21 17:30:00+00';
  v_usc_ts uuid;
  v_conflicts int;
BEGIN
  SELECT id INTO v_admin FROM public.profiles WHERE is_admin IS TRUE ORDER BY id LIMIT 1;

  SELECT ts.id INTO v_usc_ts
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE t.name = 'U13 TEST USC Rohrbach'
  LIMIT 1;

  SELECT e.id INTO v_evt
  FROM public.events e
  WHERE e.team_season_id = v_nsg_ts
    AND e.notes = 'TEST NSG Occupancy – Cross-Org'
  LIMIT 1;

  IF v_evt IS NULL THEN
    INSERT INTO public.events (
      team_season_id, kind, type, starts_at, status, notes, venue_id, created_by
    ) VALUES (
      v_nsg_ts, 'training', 'training', v_start, 'upcoming',
      'TEST NSG Occupancy – Cross-Org', v_rohrbach, v_admin
    ) RETURNING id INTO v_evt;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.event_field_assignments WHERE event_id = v_evt) THEN
    INSERT INTO public.event_field_assignments (
      club_id, event_id, venue_id, field_id, starts_at, ends_at, created_by
    ) VALUES (
      v_nsg, v_evt, v_rohrbach, v_trainingsplatz, v_start, v_end, v_admin
    );
  END IF;

  -- Prove conflict against same field/time
  SELECT count(*)::int INTO v_conflicts
  FROM public.find_event_field_assignment_conflicts_internal(
    v_nsg, v_trainingsplatz, null, v_start, v_end, null
  );
  IF v_conflicts < 1 THEN
    RAISE EXCEPTION 'Cross-Org Konfliktbasis fehlt';
  END IF;

  -- Update canceled USC conflict marker notes to point to this window for manual UI test
  UPDATE public.events
  SET notes = 'TEST U13 Training – Konflikt (Fenster 2026-08-21 16:00 UTC Trainingsplatz)'
  WHERE team_season_id = v_usc_ts
    AND notes LIKE 'TEST U13 Training – Konflikt%';

  RAISE NOTICE 'STAGING-ORG.1 cross-org occupancy OK conflicts=%', v_conflicts;
END $$;
