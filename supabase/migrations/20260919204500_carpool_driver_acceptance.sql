-- Fahrgemeinschaft: Fahrer koennen offene Platzgesuche direkt annehmen.
-- Die suchende Familie bleibt Eigentuemerin der Reservierung und erhaelt
-- Fahrer-/Abfahrtsdaten ueber die bestehende Carpool-Push-Pipeline.

-- Alte Fallback-Namen nach Moeglichkeit auf "Familie <Nachname>" anheben.
UPDATE public.event_carpool_offers o
SET driver_name = 'Familie ' || coalesce(
  (
    SELECT nullif(btrim(p.last_name), '')
    FROM public.profiles p
    WHERE p.id = o.driver_user_id
  ),
  (
    SELECT nullif(btrim(pl.last_name), '')
    FROM public.player_guardians pg
    JOIN public.players pl ON pl.id = pg.player_id
    WHERE pg.user_id = o.driver_user_id
      AND nullif(btrim(pl.last_name), '') IS NOT NULL
    ORDER BY pl.id
    LIMIT 1
  )
)
WHERE lower(btrim(o.driver_name)) = 'familie'
  AND coalesce(
    (
      SELECT nullif(btrim(p.last_name), '')
      FROM public.profiles p
      WHERE p.id = o.driver_user_id
    ),
    (
      SELECT nullif(btrim(pl.last_name), '')
      FROM public.player_guardians pg
      JOIN public.players pl ON pl.id = pg.player_id
      WHERE pg.user_id = o.driver_user_id
        AND nullif(btrim(pl.last_name), '') IS NOT NULL
      ORDER BY pl.id
      LIMIT 1
    )
  ) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_event_carpool_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_event uuid;
  v_driver_user_id uuid;
  v_seat_count integer;
  v_reserved integer;
  v_requested_by uuid;
BEGIN
  SELECT o.event_id, o.driver_user_id, o.seat_count
    INTO v_offer_event, v_driver_user_id, v_seat_count
  FROM public.event_carpool_offers o
  WHERE o.id = NEW.offer_id
  FOR UPDATE;

  IF v_offer_event IS NULL OR NEW.event_id <> v_offer_event THEN
    RAISE EXCEPTION 'Das Fahrangebot gehört nicht zu diesem Termin.';
  END IF;

  IF v_driver_user_id = auth.uid() THEN
    SELECT r.requested_by
      INTO v_requested_by
    FROM public.event_carpool_requests r
    WHERE r.event_id = NEW.event_id
      AND r.player_id = NEW.player_id
    FOR UPDATE;

    IF v_requested_by IS NOT NULL THEN
      NEW.reserved_by := v_requested_by;
    ELSIF public.carpool_can_use_player(NEW.event_id, NEW.player_id) THEN
      NEW.reserved_by := auth.uid();
    ELSE
      RAISE EXCEPTION 'Für dieses Kind liegt kein offenes Platzgesuch vor.';
    END IF;
  ELSIF public.carpool_can_use_player(NEW.event_id, NEW.player_id) THEN
    NEW.reserved_by := auth.uid();
  ELSE
    RAISE EXCEPTION 'Für dieses Kind darf kein Platz reserviert werden.';
  END IF;

  SELECT count(*) INTO v_reserved
  FROM public.event_carpool_reservations r
  WHERE r.offer_id = NEW.offer_id
    AND (TG_OP = 'INSERT' OR r.id <> NEW.id);

  IF v_reserved >= v_seat_count THEN
    RAISE EXCEPTION 'Diese Fahrgemeinschaft ist bereits voll.';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS event_carpool_reservations_insert_own_player
  ON public.event_carpool_reservations;
CREATE POLICY event_carpool_reservations_insert_own_player
  ON public.event_carpool_reservations FOR INSERT TO authenticated
  WITH CHECK (
    (
      reserved_by = auth.uid()
      AND public.carpool_can_use_player(event_id, player_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_carpool_offers o
      JOIN public.event_carpool_requests req
        ON req.event_id = event_carpool_reservations.event_id
       AND req.player_id = event_carpool_reservations.player_id
       AND req.requested_by = event_carpool_reservations.reserved_by
      WHERE o.id = event_carpool_reservations.offer_id
        AND o.event_id = event_carpool_reservations.event_id
        AND o.driver_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS event_carpool_reservations_delete_own_player
  ON public.event_carpool_reservations;
CREATE POLICY event_carpool_reservations_delete_own_player
  ON public.event_carpool_reservations FOR DELETE TO authenticated
  USING (
    reserved_by = auth.uid()
    OR public.carpool_can_use_player(event_id, player_id)
    OR public.carpool_can_manage_event(event_id)
    OR EXISTS (
      SELECT 1
      FROM public.event_carpool_offers o
      WHERE o.id = event_carpool_reservations.offer_id
        AND o.driver_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.accept_event_carpool_request(
  p_offer_id uuid,
  p_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_driver_user_id uuid;
  v_seat_count integer;
  v_reserved integer;
  v_request_event_id uuid;
  v_player_id uuid;
  v_requested_by uuid;
  v_reservation_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich.';
  END IF;

  SELECT o.event_id, o.driver_user_id, o.seat_count
    INTO v_event_id, v_driver_user_id, v_seat_count
  FROM public.event_carpool_offers o
  WHERE o.id = p_offer_id
  FOR UPDATE;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Fahrangebot nicht gefunden.';
  END IF;
  IF v_driver_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Nur der Fahrer kann dieses Platzgesuch annehmen.';
  END IF;

  SELECT r.event_id, r.player_id, r.requested_by
    INTO v_request_event_id, v_player_id, v_requested_by
  FROM public.event_carpool_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF v_request_event_id IS NULL OR v_request_event_id <> v_event_id THEN
    RAISE EXCEPTION 'Platzgesuch nicht gefunden oder nicht für diese Fahrt gültig.';
  END IF;

  SELECT count(*) INTO v_reserved
  FROM public.event_carpool_reservations r
  WHERE r.offer_id = p_offer_id;
  IF v_reserved >= v_seat_count THEN
    RAISE EXCEPTION 'Diese Fahrgemeinschaft ist bereits voll.';
  END IF;

  INSERT INTO public.event_carpool_reservations (
    event_id,
    offer_id,
    player_id,
    reserved_by
  ) VALUES (
    v_event_id,
    p_offer_id,
    v_player_id,
    v_requested_by
  )
  RETURNING id INTO v_reservation_id;

  DELETE FROM public.event_carpool_requests
  WHERE id = p_request_id;

  RETURN v_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_event_carpool_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_event_carpool_request(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_event_carpool_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_offer_id uuid;
  v_team_id uuid;
  v_kind text;
  v_title text;
  v_body text;
  v_recipients uuid[] := ARRAY[]::uuid[];
  v_driver_id uuid;
  v_driver_name text;
  v_departure_at timestamptz;
  v_departure_location text;
  v_player_name text;
  v_reservation_owner uuid;
  v_actor_id uuid := auth.uid();
  v_should_send boolean := true;
BEGIN
  IF TG_TABLE_NAME = 'event_carpool_offers' THEN
    IF TG_OP = 'DELETE' THEN
      v_event_id := OLD.event_id;
      v_offer_id := OLD.id;
    ELSE
      v_event_id := NEW.event_id;
      v_offer_id := NEW.id;
    END IF;

    IF TG_OP = 'INSERT' THEN
      v_title := 'Neue Fahrgemeinschaft';
      v_body := NEW.driver_name || ' bietet eine Fahrt an: ' ||
        to_char(NEW.departure_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
        ' Uhr ab ' || NEW.departure_location || '.';
      SELECT coalesce(array_agg(DISTINCT m.user_id), ARRAY[]::uuid[])
        INTO v_recipients
      FROM public.events e
      JOIN public.memberships m ON m.team_season_id = e.team_season_id
      WHERE e.id = v_event_id
        AND lower(m.role::text) IN ('parent', 'player')
        AND m.user_id <> NEW.driver_user_id;
    ELSIF TG_OP = 'UPDATE' THEN
      v_should_send :=
        NEW.departure_at IS DISTINCT FROM OLD.departure_at OR
        NEW.departure_location IS DISTINCT FROM OLD.departure_location OR
        NEW.seat_count IS DISTINCT FROM OLD.seat_count OR
        NEW.return_included IS DISTINCT FROM OLD.return_included OR
        NEW.note IS DISTINCT FROM OLD.note;
      v_title := 'Fahrgemeinschaft geändert';
      v_body := NEW.driver_name || ' hat die Fahrt geändert: ' ||
        to_char(NEW.departure_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
        ' Uhr ab ' || NEW.departure_location || '.';
      SELECT coalesce(array_agg(DISTINCT r.reserved_by), ARRAY[]::uuid[])
        INTO v_recipients
      FROM public.event_carpool_reservations r
      WHERE r.offer_id = v_offer_id
        AND r.reserved_by <> NEW.driver_user_id;
    ELSE
      v_title := 'Fahrgemeinschaft abgesagt';
      v_body := OLD.driver_name || ' hat die angebotene Fahrt abgesagt.';
      SELECT coalesce(array_agg(DISTINCT r.reserved_by), ARRAY[]::uuid[])
        INTO v_recipients
      FROM public.event_carpool_reservations r
      WHERE r.offer_id = v_offer_id
        AND r.reserved_by <> OLD.driver_user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'event_carpool_reservations' THEN
    IF TG_OP = 'DELETE' THEN
      v_event_id := OLD.event_id;
      v_offer_id := OLD.offer_id;
      v_reservation_owner := OLD.reserved_by;
    ELSE
      v_event_id := NEW.event_id;
      v_offer_id := NEW.offer_id;
      v_reservation_owner := NEW.reserved_by;
    END IF;

    SELECT o.driver_user_id, o.driver_name, o.departure_at, o.departure_location
      INTO v_driver_id, v_driver_name, v_departure_at, v_departure_location
    FROM public.event_carpool_offers o
    WHERE o.id = v_offer_id;

    SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Ein Kind')
      INTO v_player_name
    FROM public.players p
    WHERE p.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.player_id ELSE NEW.player_id END;

    IF TG_OP = 'INSERT' AND v_actor_id = v_driver_id AND v_reservation_owner <> v_driver_id THEN
      v_title := 'Mitfahrplatz bestätigt';
      v_body := coalesce(v_driver_name, 'Die Fahrerfamilie') || ' nimmt ' ||
        coalesce(v_player_name, 'dein Kind') || ' mit. Abfahrt ' ||
        to_char(v_departure_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
        ' Uhr ab ' || coalesce(v_departure_location, 'dem vereinbarten Treffpunkt') || '.';
      v_recipients := ARRAY[v_reservation_owner];
    ELSIF TG_OP = 'DELETE' AND v_actor_id = v_driver_id AND v_reservation_owner <> v_driver_id THEN
      v_title := 'Mitfahrplatz storniert';
      v_body := coalesce(v_driver_name, 'Die Fahrerfamilie') || ' kann ' ||
        coalesce(v_player_name, 'dein Kind') || ' nicht mehr mitnehmen.';
      v_recipients := ARRAY[v_reservation_owner];
    ELSIF TG_OP = 'INSERT' THEN
      v_title := 'Mitfahrplatz reserviert';
      v_body := coalesce(v_player_name, 'Ein Kind') || ' wurde für deine Fahrt eingetragen.';
      IF v_driver_id IS NOT NULL AND v_driver_id <> v_actor_id THEN
        v_recipients := ARRAY[v_driver_id];
      END IF;
    ELSE
      v_title := 'Mitfahrplatz freigegeben';
      v_body := coalesce(v_player_name, 'Ein Kind') || ' fährt nicht mehr bei dir mit.';
      IF v_driver_id IS NOT NULL AND v_driver_id <> v_actor_id THEN
        v_recipients := ARRAY[v_driver_id];
      END IF;
    END IF;
  END IF;

  IF NOT v_should_send OR coalesce(array_length(v_recipients, 1), 0) = 0 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT ts.team_id,
    CASE WHEN e.kind = 'match' THEN 'match'
         WHEN e.kind = 'training' THEN 'training'
         ELSE 'event' END
    INTO v_team_id, v_kind
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE e.id = v_event_id;

  IF v_team_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  INSERT INTO public.notification_jobs (
    event_id, team_id, kind, send_at, payload, status, dedupe_key
  ) VALUES (
    v_event_id,
    v_team_id,
    v_kind,
    now(),
    jsonb_build_object(
      'automation', 'carpool',
      'pushTitle', v_title,
      'pushBody', v_body,
      'linkPath', '/app/events/' || v_event_id::text,
      'recipientUserIds', to_jsonb(v_recipients)
    ),
    'pending',
    'carpool:' || v_event_id::text || ':' || gen_random_uuid()::text
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_event_carpool_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_player_id uuid;
  v_requested_by uuid;
  v_team_id uuid;
  v_kind text;
  v_title text;
  v_body text;
  v_player_name text;
  v_recipients uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_id := NEW.event_id;
    v_player_id := NEW.player_id;
    v_requested_by := NEW.requested_by;
    v_title := 'Mitfahrplatz gesucht';
  ELSE
    -- Bei erfolgreicher Zuordnung informiert bereits die Reservierungs-
    -- Benachrichtigung gezielt die suchende Familie.
    IF EXISTS (
      SELECT 1
      FROM public.event_carpool_reservations r
      WHERE r.event_id = OLD.event_id
        AND r.player_id = OLD.player_id
    ) THEN
      RETURN OLD;
    END IF;
    v_event_id := OLD.event_id;
    v_player_id := OLD.player_id;
    v_requested_by := OLD.requested_by;
    v_title := 'Platzgesuch erledigt';
  END IF;

  SELECT coalesce(
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
    'Ein Kind'
  )
  INTO v_player_name
  FROM public.players p
  WHERE p.id = v_player_id;

  IF TG_OP = 'INSERT' THEN
    v_body := coalesce(v_player_name, 'Ein Kind') || ' sucht noch einen Mitfahrplatz.';
  ELSE
    v_body := coalesce(v_player_name, 'Ein Kind') || ' benötigt keinen Mitfahrplatz mehr.';
  END IF;

  SELECT
    ts.team_id,
    CASE WHEN e.kind = 'match' THEN 'match'
         WHEN e.kind = 'training' THEN 'training'
         ELSE 'event' END
  INTO v_team_id, v_kind
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE e.id = v_event_id;

  SELECT coalesce(array_agg(DISTINCT m.user_id), ARRAY[]::uuid[])
  INTO v_recipients
  FROM public.events e
  JOIN public.memberships m ON m.team_season_id = e.team_season_id
  WHERE e.id = v_event_id
    AND lower(m.role::text) IN ('parent', 'player')
    AND m.user_id IS NOT NULL
    AND m.user_id <> v_requested_by;

  IF v_team_id IS NULL OR coalesce(array_length(v_recipients, 1), 0) = 0 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  INSERT INTO public.notification_jobs (
    event_id, team_id, kind, send_at, payload, status, dedupe_key
  ) VALUES (
    v_event_id,
    v_team_id,
    v_kind,
    now(),
    jsonb_build_object(
      'automation', 'carpool',
      'pushTitle', v_title,
      'pushBody', v_body,
      'linkPath', '/app/events/' || v_event_id::text,
      'recipientUserIds', to_jsonb(v_recipients)
    ),
    'pending',
    'carpool-request:' || v_event_id::text || ':' || gen_random_uuid()::text
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
