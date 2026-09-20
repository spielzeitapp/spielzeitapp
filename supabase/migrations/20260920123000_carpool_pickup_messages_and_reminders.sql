-- Fahrgemeinschaften: persoenliche Abholinfos, Fahrer-Bestaetigung und
-- automatische Erinnerung 90 Minuten vor der Abfahrt.

CREATE TABLE IF NOT EXISTS public.event_carpool_pickup_details (
  reservation_id uuid PRIMARY KEY
    REFERENCES public.event_carpool_reservations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.event_carpool_offers(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_at timestamptz NOT NULL,
  pickup_location text NOT NULL
    CHECK (char_length(btrim(pickup_location)) BETWEEN 1 AND 240),
  message text NULL CHECK (message IS NULL OR char_length(message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_carpool_pickup_details_event_idx
  ON public.event_carpool_pickup_details(event_id);

DROP TRIGGER IF EXISTS trg_event_carpool_pickup_details_updated_at
  ON public.event_carpool_pickup_details;
CREATE TRIGGER trg_event_carpool_pickup_details_updated_at
  BEFORE UPDATE ON public.event_carpool_pickup_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.event_carpool_pickup_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_carpool_pickup_details_select_participants
  ON public.event_carpool_pickup_details;
CREATE POLICY event_carpool_pickup_details_select_participants
  ON public.event_carpool_pickup_details FOR SELECT TO authenticated
  USING (
    auth.uid() = driver_user_id
    OR auth.uid() = recipient_user_id
    OR public.carpool_can_manage_event(event_id)
  );

GRANT SELECT ON public.event_carpool_pickup_details TO authenticated;

CREATE OR REPLACE FUNCTION public.set_event_carpool_pickup_details(
  p_reservation_id uuid,
  p_pickup_at timestamptz,
  p_pickup_location text,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_offer_id uuid;
  v_player_id uuid;
  v_recipient_user_id uuid;
  v_driver_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich.';
  END IF;
  IF p_pickup_at IS NULL THEN
    RAISE EXCEPTION 'Bitte eine Abholzeit angeben.';
  END IF;
  IF nullif(btrim(coalesce(p_pickup_location, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Bitte einen Abholort angeben.';
  END IF;

  SELECT r.event_id, r.offer_id, r.player_id, r.reserved_by, o.driver_user_id
    INTO v_event_id, v_offer_id, v_player_id, v_recipient_user_id, v_driver_user_id
  FROM public.event_carpool_reservations r
  JOIN public.event_carpool_offers o ON o.id = r.offer_id
  WHERE r.id = p_reservation_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Mitfahrer wurde nicht gefunden.';
  END IF;
  IF v_driver_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Nur der Fahrer kann die Abholung vereinbaren.';
  END IF;

  INSERT INTO public.event_carpool_pickup_details (
    reservation_id,
    event_id,
    offer_id,
    player_id,
    driver_user_id,
    recipient_user_id,
    pickup_at,
    pickup_location,
    message
  ) VALUES (
    p_reservation_id,
    v_event_id,
    v_offer_id,
    v_player_id,
    v_driver_user_id,
    v_recipient_user_id,
    p_pickup_at,
    btrim(p_pickup_location),
    nullif(btrim(coalesce(p_message, '')), '')
  )
  ON CONFLICT (reservation_id) DO UPDATE SET
    pickup_at = EXCLUDED.pickup_at,
    pickup_location = EXCLUDED.pickup_location,
    message = EXCLUDED.message,
    driver_user_id = EXCLUDED.driver_user_id,
    recipient_user_id = EXCLUDED.recipient_user_id;

  RETURN p_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_carpool_pickup_details(uuid, timestamptz, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_carpool_pickup_details(uuid, timestamptz, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_event_carpool_pickup_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_kind text;
  v_driver_name text;
  v_player_name text;
  v_body text;
BEGIN
  SELECT
    ts.team_id,
    CASE WHEN e.kind = 'match' THEN 'match'
         WHEN e.kind = 'training' THEN 'training'
         ELSE 'event' END
    INTO v_team_id, v_kind
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE e.id = NEW.event_id;

  SELECT o.driver_name INTO v_driver_name
  FROM public.event_carpool_offers o
  WHERE o.id = NEW.offer_id;

  SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'dein Kind')
    INTO v_player_name
  FROM public.players p
  WHERE p.id = NEW.player_id;

  v_body := coalesce(v_driver_name, 'Die Fahrerfamilie') || ' holt ' ||
    coalesce(v_player_name, 'dein Kind') || ' um ' ||
    to_char(NEW.pickup_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
    ' Uhr bei ' || NEW.pickup_location || ' ab.';
  IF NEW.message IS NOT NULL THEN
    v_body := v_body || ' ' || NEW.message;
  END IF;

  IF v_team_id IS NOT NULL AND NEW.recipient_user_id <> NEW.driver_user_id THEN
    INSERT INTO public.notification_jobs (
      event_id, team_id, kind, send_at, payload, status, dedupe_key
    ) VALUES (
      NEW.event_id,
      v_team_id,
      v_kind,
      now(),
      jsonb_build_object(
        'automation', 'carpool',
        'pushTitle', CASE WHEN TG_OP = 'INSERT' THEN 'Abholung vereinbart' ELSE 'Abholung geändert' END,
        'pushBody', v_body,
        'linkPath', '/app/events/' || NEW.event_id::text,
        'recipientUserIds', jsonb_build_array(NEW.recipient_user_id)
      ),
      'pending',
      'carpool-pickup:' || NEW.reservation_id::text || ':' || gen_random_uuid()::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_carpool_pickup_notification
  ON public.event_carpool_pickup_details;
CREATE TRIGGER trg_event_carpool_pickup_notification
  AFTER INSERT OR UPDATE OF pickup_at, pickup_location, message
  ON public.event_carpool_pickup_details
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_event_carpool_pickup_notification();

-- Wenn der Fahrer ein offenes Platzgesuch annimmt, bekommt er neben der
-- suchenden Familie ebenfalls eine eindeutige Bestaetigung in Push und Inbox.
CREATE OR REPLACE FUNCTION public.enqueue_event_carpool_driver_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_kind text;
  v_driver_user_id uuid;
  v_departure_at timestamptz;
  v_departure_location text;
  v_player_name text;
BEGIN
  SELECT o.driver_user_id, o.departure_at, o.departure_location
    INTO v_driver_user_id, v_departure_at, v_departure_location
  FROM public.event_carpool_offers o
  WHERE o.id = NEW.offer_id;

  IF auth.uid() IS DISTINCT FROM v_driver_user_id
     OR NEW.reserved_by = v_driver_user_id THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Ein Kind')
    INTO v_player_name
  FROM public.players p
  WHERE p.id = NEW.player_id;

  SELECT
    ts.team_id,
    CASE WHEN e.kind = 'match' THEN 'match'
         WHEN e.kind = 'training' THEN 'training'
         ELSE 'event' END
    INTO v_team_id, v_kind
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE e.id = NEW.event_id;

  IF v_team_id IS NOT NULL THEN
    INSERT INTO public.notification_jobs (
      event_id, team_id, kind, send_at, payload, status, dedupe_key
    ) VALUES (
      NEW.event_id,
      v_team_id,
      v_kind,
      now(),
      jsonb_build_object(
        'automation', 'carpool',
        'pushTitle', 'Mitfahrer übernommen',
        'pushBody', 'Du nimmst ' || coalesce(v_player_name, 'ein Kind') ||
          ' mit. Abfahrt ' ||
          to_char(v_departure_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
          ' Uhr ab ' || v_departure_location || '.',
        'linkPath', '/app/events/' || NEW.event_id::text,
        'recipientUserIds', jsonb_build_array(v_driver_user_id)
      ),
      'pending',
      'carpool-driver-confirmation:' || NEW.id::text || ':' || gen_random_uuid()::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_carpool_driver_confirmation
  ON public.event_carpool_reservations;
CREATE TRIGGER trg_event_carpool_driver_confirmation
  AFTER INSERT ON public.event_carpool_reservations
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_event_carpool_driver_confirmation();

-- Erstellt bzw. aktualisiert die Erinnerung fuer die mitfahrende Familie.
CREATE OR REPLACE FUNCTION public.refresh_event_carpool_rider_reminder(
  p_reservation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_team_id uuid;
  v_kind text;
  v_offer_id uuid;
  v_recipient_user_id uuid;
  v_driver_name text;
  v_departure_at timestamptz;
  v_departure_location text;
  v_player_name text;
  v_pickup_at timestamptz;
  v_pickup_location text;
  v_message text;
  v_send_at timestamptz;
  v_body text;
  v_key text := 'carpool-reminder-rider:' || p_reservation_id::text;
BEGIN
  SELECT
    r.event_id,
    r.offer_id,
    r.reserved_by,
    o.driver_name,
    o.departure_at,
    o.departure_location,
    coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Dein Kind'),
    d.pickup_at,
    d.pickup_location,
    d.message,
    ts.team_id,
    CASE WHEN e.kind = 'match' THEN 'match'
         WHEN e.kind = 'training' THEN 'training'
         ELSE 'event' END
    INTO
      v_event_id, v_offer_id, v_recipient_user_id, v_driver_name,
      v_departure_at, v_departure_location, v_player_name,
      v_pickup_at, v_pickup_location, v_message, v_team_id, v_kind
  FROM public.event_carpool_reservations r
  JOIN public.event_carpool_offers o ON o.id = r.offer_id
  JOIN public.players p ON p.id = r.player_id
  JOIN public.events e ON e.id = r.event_id
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  LEFT JOIN public.event_carpool_pickup_details d ON d.reservation_id = r.id
  WHERE r.id = p_reservation_id;

  IF v_event_id IS NULL THEN
    DELETE FROM public.notification_jobs
    WHERE dedupe_key = v_key AND status IN ('pending', 'failed');
    RETURN;
  END IF;

  v_send_at := v_departure_at - interval '90 minutes';
  IF v_send_at <= now() THEN
    DELETE FROM public.notification_jobs
    WHERE dedupe_key = v_key AND status IN ('pending', 'failed');
    RETURN;
  END IF;

  IF v_pickup_at IS NOT NULL THEN
    v_body := coalesce(v_player_name, 'Dein Kind') || ' wird um ' ||
      to_char(v_pickup_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
      ' Uhr bei ' || v_pickup_location || ' von ' ||
      coalesce(v_driver_name, 'der Fahrerfamilie') || ' abgeholt.';
  ELSE
    v_body := coalesce(v_player_name, 'Dein Kind') || ' fährt bei ' ||
      coalesce(v_driver_name, 'der Fahrerfamilie') || ' mit. Abfahrt ' ||
      to_char(v_departure_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
      ' Uhr ab ' || v_departure_location || '.';
  END IF;

  INSERT INTO public.notification_jobs (
    event_id, team_id, kind, send_at, payload, status, dedupe_key
  ) VALUES (
    v_event_id,
    v_team_id,
    v_kind,
    v_send_at,
    jsonb_build_object(
      'automation', 'carpool',
      'pushTitle', 'Erinnerung: Fahrgemeinschaft',
      'pushBody', v_body,
      'linkPath', '/app/events/' || v_event_id::text,
      'recipientUserIds', jsonb_build_array(v_recipient_user_id)
    ),
    'pending',
    v_key
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    send_at = EXCLUDED.send_at,
    payload = EXCLUDED.payload,
    status = 'pending',
    attempt_count = 0,
    last_error = NULL,
    sent_at = NULL
  WHERE public.notification_jobs.status IN ('pending', 'failed');
END;
$$;

-- Eine gemeinsame Erinnerung fuer den Fahrer verhindert mehrere Pushes, wenn
-- mehrere Kinder in derselben Fahrt eingetragen sind.
CREATE OR REPLACE FUNCTION public.refresh_event_carpool_driver_reminder(
  p_offer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_team_id uuid;
  v_kind text;
  v_driver_user_id uuid;
  v_departure_at timestamptz;
  v_departure_location text;
  v_player_names text;
  v_send_at timestamptz;
  v_key text := 'carpool-reminder-driver:' || p_offer_id::text;
BEGIN
  SELECT
    o.event_id,
    o.driver_user_id,
    o.departure_at,
    o.departure_location,
    ts.team_id,
    CASE WHEN e.kind = 'match' THEN 'match'
         WHEN e.kind = 'training' THEN 'training'
         ELSE 'event' END
    INTO v_event_id, v_driver_user_id, v_departure_at,
      v_departure_location, v_team_id, v_kind
  FROM public.event_carpool_offers o
  JOIN public.events e ON e.id = o.event_id
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE o.id = p_offer_id;

  SELECT string_agg(
      coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Spieler'),
      ', ' ORDER BY p.first_name, p.last_name
    )
    INTO v_player_names
  FROM public.event_carpool_reservations r
  JOIN public.players p ON p.id = r.player_id
  WHERE r.offer_id = p_offer_id;

  IF v_event_id IS NULL OR v_player_names IS NULL THEN
    DELETE FROM public.notification_jobs
    WHERE dedupe_key = v_key AND status IN ('pending', 'failed');
    RETURN;
  END IF;

  v_send_at := v_departure_at - interval '90 minutes';
  IF v_send_at <= now() THEN
    DELETE FROM public.notification_jobs
    WHERE dedupe_key = v_key AND status IN ('pending', 'failed');
    RETURN;
  END IF;

  INSERT INTO public.notification_jobs (
    event_id, team_id, kind, send_at, payload, status, dedupe_key
  ) VALUES (
    v_event_id,
    v_team_id,
    v_kind,
    v_send_at,
    jsonb_build_object(
      'automation', 'carpool',
      'pushTitle', 'Erinnerung: Deine Fahrt',
      'pushBody', 'Du nimmst ' || v_player_names || ' mit. Abfahrt ' ||
        to_char(v_departure_at AT TIME ZONE 'Europe/Vienna', 'HH24:MI') ||
        ' Uhr ab ' || v_departure_location || '.',
      'linkPath', '/app/events/' || v_event_id::text,
      'recipientUserIds', jsonb_build_array(v_driver_user_id)
    ),
    'pending',
    v_key
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    send_at = EXCLUDED.send_at,
    payload = EXCLUDED.payload,
    status = 'pending',
    attempt_count = 0,
    last_error = NULL,
    sent_at = NULL
  WHERE public.notification_jobs.status IN ('pending', 'failed');
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_carpool_reservation_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notification_jobs
    WHERE dedupe_key = 'carpool-reminder-rider:' || OLD.id::text
      AND status IN ('pending', 'failed');
    PERFORM public.refresh_event_carpool_driver_reminder(OLD.offer_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_event_carpool_rider_reminder(NEW.id);
  PERFORM public.refresh_event_carpool_driver_reminder(NEW.offer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_carpool_reservation_reminders
  ON public.event_carpool_reservations;
CREATE TRIGGER trg_event_carpool_reservation_reminders
  AFTER INSERT OR DELETE ON public.event_carpool_reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_carpool_reservation_reminders();

CREATE OR REPLACE FUNCTION public.sync_event_carpool_pickup_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_event_carpool_rider_reminder(NEW.reservation_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_carpool_pickup_reminder
  ON public.event_carpool_pickup_details;
CREATE TRIGGER trg_event_carpool_pickup_reminder
  AFTER INSERT OR UPDATE OF pickup_at, pickup_location, message
  ON public.event_carpool_pickup_details
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_carpool_pickup_reminder();

CREATE OR REPLACE FUNCTION public.sync_event_carpool_offer_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notification_jobs
    WHERE dedupe_key = 'carpool-reminder-driver:' || OLD.id::text
      AND status IN ('pending', 'failed');
    RETURN OLD;
  END IF;

  FOR v_reservation IN
    SELECT r.id FROM public.event_carpool_reservations r WHERE r.offer_id = NEW.id
  LOOP
    PERFORM public.refresh_event_carpool_rider_reminder(v_reservation.id);
  END LOOP;
  PERFORM public.refresh_event_carpool_driver_reminder(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_carpool_offer_reminders
  ON public.event_carpool_offers;
CREATE TRIGGER trg_event_carpool_offer_reminders
  AFTER UPDATE OF departure_at, departure_location ON public.event_carpool_offers
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_carpool_offer_reminders();

-- Auch bereits bestehende, zukuenftige Reservierungen erhalten die Erinnerung.
DO $$
DECLARE
  v_reservation record;
  v_offer_id uuid;
BEGIN
  FOR v_reservation IN
    SELECT r.id, r.offer_id
    FROM public.event_carpool_reservations r
    JOIN public.event_carpool_offers o ON o.id = r.offer_id
    WHERE o.departure_at > now() + interval '90 minutes'
  LOOP
    PERFORM public.refresh_event_carpool_rider_reminder(v_reservation.id);
  END LOOP;

  FOR v_offer_id IN
    SELECT DISTINCT r.offer_id
    FROM public.event_carpool_reservations r
    JOIN public.event_carpool_offers o ON o.id = r.offer_id
    WHERE o.departure_at > now() + interval '90 minutes'
  LOOP
    PERFORM public.refresh_event_carpool_driver_reminder(v_offer_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_event_carpool_rider_reminder(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_event_carpool_driver_reminder(uuid) FROM PUBLIC;

SELECT pg_notify('pgrst', 'reload schema');
