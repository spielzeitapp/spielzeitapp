-- STEP 2B staging-only conflict/structure verification.
-- Creates and removes clearly labeled TEST STEP 2B rows.
-- Does not delete events.

DO $$
DECLARE
  v_club uuid;
  v_venue uuid;
  v_field uuid;
  v_zone_n uuid;
  v_zone_s uuid;
  v_event1 uuid;
  v_event2 uuid;
  v_event3 uuid;
  v_a1 uuid;
  v_ok boolean;
BEGIN
  SELECT v.club_id, v.id INTO v_club, v_venue
  FROM public.venues v
  WHERE v.is_active = true
  ORDER BY v.created_at
  LIMIT 1;

  IF v_club IS NULL THEN
    RAISE EXCEPTION 'No active venue on staging';
  END IF;

  INSERT INTO public.venue_fields (venue_id, club_id, name, field_type, color_hex, sort_order, is_active)
  VALUES (v_venue, v_club, 'TEST STEP 2B – Hauptfeld', 'main', '#B91C1C', 999, true)
  RETURNING id INTO v_field;

  INSERT INTO public.venue_field_zones (field_id, club_id, name, blocks_entire_field, sort_order, is_active)
  VALUES (v_field, v_club, 'TEST STEP 2B – Hälfte Nord', false, 1, true)
  RETURNING id INTO v_zone_n;

  INSERT INTO public.venue_field_zones (field_id, club_id, name, blocks_entire_field, sort_order, is_active)
  VALUES (v_field, v_club, 'TEST STEP 2B – Hälfte Süd', false, 2, true)
  RETURNING id INTO v_zone_s;

  -- Pick three future events from active/draft seasons if available
  SELECT e.id INTO v_event1
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE ts.status IN ('active','draft')
    AND coalesce(e.status,'') NOT IN ('canceled','cancelled')
    AND e.starts_at > now()
  ORDER BY e.starts_at
  LIMIT 1;

  SELECT e.id INTO v_event2
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE ts.status IN ('active','draft')
    AND coalesce(e.status,'') NOT IN ('canceled','cancelled')
    AND e.starts_at > now()
    AND e.id <> v_event1
  ORDER BY e.starts_at
  LIMIT 1 OFFSET 1;

  SELECT e.id INTO v_event3
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE ts.status IN ('active','draft')
    AND coalesce(e.status,'') NOT IN ('canceled','cancelled')
    AND e.starts_at > now()
    AND e.id NOT IN (v_event1, coalesce(v_event2, '00000000-0000-0000-0000-000000000000'::uuid))
  ORDER BY e.starts_at
  LIMIT 1 OFFSET 2;

  IF v_event1 IS NULL OR v_event2 IS NULL THEN
    RAISE EXCEPTION 'Need at least 2 future staging events for conflict tests';
  END IF;

  -- Baseline entire-field assignment
  INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
  VALUES (
    v_club, v_event1, v_venue, v_field, NULL,
    '2030-01-10 17:00:00+01', '2030-01-10 18:00:00+01'
  ) RETURNING id INTO v_a1;

  -- Must fail: entire vs entire overlap
  BEGIN
    INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
    VALUES (v_club, v_event2, v_venue, v_field, NULL, '2030-01-10 17:30:00+01', '2030-01-10 18:30:00+01');
    RAISE EXCEPTION 'FAIL: entire vs entire should conflict';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS entire_vs_entire';
  END;

  -- Must fail: entire vs zone
  BEGIN
    INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
    VALUES (v_club, v_event2, v_venue, v_field, v_zone_n, '2030-01-10 17:15:00+01', '2030-01-10 17:45:00+01');
    RAISE EXCEPTION 'FAIL: entire vs zone should conflict';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS entire_vs_zone';
  END;

  -- Remove baseline for half tests
  DELETE FROM public.event_field_assignments WHERE id = v_a1;

  -- North half
  INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
  VALUES (v_club, v_event1, v_venue, v_field, v_zone_n, '2030-01-11 17:00:00+01', '2030-01-11 18:00:00+01');

  -- Must allow: south half same time
  INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
  VALUES (v_club, v_event2, v_venue, v_field, v_zone_s, '2030-01-11 17:00:00+01', '2030-01-11 18:00:00+01');
  RAISE NOTICE 'PASS different_halves';

  -- Must fail: same north half
  IF v_event3 IS NOT NULL THEN
    BEGIN
      INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
      VALUES (v_club, v_event3, v_venue, v_field, v_zone_n, '2030-01-11 17:30:00+01', '2030-01-11 18:30:00+01');
      RAISE EXCEPTION 'FAIL: same zone should conflict';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PASS same_zone';
    END;

    -- Must fail: zone then entire
    BEGIN
      INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
      VALUES (v_club, v_event3, v_venue, v_field, NULL, '2030-01-11 17:00:00+01', '2030-01-11 18:00:00+01');
      RAISE EXCEPTION 'FAIL: zone vs entire should conflict';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PASS zone_vs_entire';
    END;
  END IF;

  -- Must allow: adjacent boundary (18:00-19:00 after 17:00-18:00 north)
  DELETE FROM public.event_field_assignments WHERE field_id = v_field;
  INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
  VALUES (v_club, v_event1, v_venue, v_field, NULL, '2030-01-12 17:00:00+01', '2030-01-12 18:00:00+01');
  INSERT INTO public.event_field_assignments (club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at)
  VALUES (v_club, v_event2, v_venue, v_field, NULL, '2030-01-12 18:00:00+01', '2030-01-12 19:00:00+01');
  RAISE NOTICE 'PASS adjacent_boundary';

  -- Cleanup assignments/fields/zones only (never events)
  DELETE FROM public.event_field_assignments WHERE field_id = v_field;
  DELETE FROM public.venue_field_zones WHERE field_id = v_field;
  DELETE FROM public.venue_fields WHERE id = v_field;

  RAISE NOTICE 'CLEANUP_DONE club=% venue=% field_removed=true events_untouched=true', v_club, v_venue;
END $$;

SELECT 'step2b_db_conflict_tests_ok' AS result;
