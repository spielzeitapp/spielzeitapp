-- Safety repair after an accidental one-tap passenger removal.
-- The lookup is deliberately restricted to one player, one departure and one event day.
DO $$
DECLARE
  v_offer_id uuid;
  v_event_id uuid;
  v_player_id uuid;
  v_guardian_id uuid;
  v_offer_ids uuid[];
  v_event_ids uuid[];
  v_guardian_ids uuid[];
  v_offer_count integer;
  v_guardian_count integer;
BEGIN
  SELECT array_agg(DISTINCT o.id), array_agg(DISTINCT o.event_id)
    INTO v_offer_ids, v_event_ids
  FROM public.event_carpool_offers o
  JOIN public.events e ON e.id = o.event_id
  JOIN public.team_season_players tsp ON tsp.team_season_id = e.team_season_id
  JOIN public.players p ON p.id = tsp.player_id
  WHERE lower(btrim(p.first_name)) = 'nino'
    AND lower(btrim(p.last_name)) = 'semmellechner'
    AND (o.departure_at AT TIME ZONE 'Europe/Vienna')::date = DATE '2026-09-22'
    AND (o.departure_at AT TIME ZONE 'Europe/Vienna')::time = TIME '16:10'
    AND lower(btrim(o.departure_location)) = lower('Am alten Sportplatz 17');

  v_offer_count := coalesce(cardinality(v_offer_ids), 0);
  IF v_offer_count = 0 THEN
    RAISE NOTICE 'No matching Nino carpool reservation repair target in this environment.';
    RETURN;
  END IF;
  IF v_offer_count <> 1 THEN
    RAISE EXCEPTION 'Nino carpool repair aborted: expected one offer, found %.', v_offer_count;
  END IF;
  v_offer_id := v_offer_ids[1];
  v_event_id := v_event_ids[1];

  SELECT p.id
    INTO v_player_id
  FROM public.players p
  JOIN public.team_season_players tsp ON tsp.player_id = p.id
  JOIN public.events e ON e.team_season_id = tsp.team_season_id
  WHERE e.id = v_event_id
    AND lower(btrim(p.first_name)) = 'nino'
    AND lower(btrim(p.last_name)) = 'semmellechner'
  LIMIT 1;

  SELECT array_agg(DISTINCT pg.user_id)
    INTO v_guardian_ids
  FROM public.player_guardians pg
  WHERE pg.player_id = v_player_id;

  v_guardian_count := coalesce(cardinality(v_guardian_ids), 0);
  IF v_guardian_count <> 1 THEN
    RAISE EXCEPTION 'Nino carpool repair aborted: expected one guardian, found %.', v_guardian_count;
  END IF;
  v_guardian_id := v_guardian_ids[1];

  -- The normal validator uses auth.uid(); migrations intentionally have no app user.
  ALTER TABLE public.event_carpool_reservations
    DISABLE TRIGGER trg_validate_event_carpool_reservation;

  INSERT INTO public.event_carpool_reservations (
    event_id,
    offer_id,
    player_id,
    reserved_by
  ) VALUES (
    v_event_id,
    v_offer_id,
    v_player_id,
    v_guardian_id
  )
  ON CONFLICT (event_id, player_id) DO NOTHING;

  ALTER TABLE public.event_carpool_reservations
    ENABLE TRIGGER trg_validate_event_carpool_reservation;

  DELETE FROM public.event_carpool_requests
  WHERE event_id = v_event_id
    AND player_id = v_player_id;
END;
$$;
