-- Die mitfahrende Familie bestaetigt die persoenliche Abholvereinbarung.
-- Bei einer spaeteren Aenderung durch den Fahrer wird die Bestaetigung erneut offen.

ALTER TABLE public.event_carpool_pickup_details
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

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
    message,
    confirmed_at,
    confirmed_by
  ) VALUES (
    p_reservation_id,
    v_event_id,
    v_offer_id,
    v_player_id,
    v_driver_user_id,
    v_recipient_user_id,
    p_pickup_at,
    btrim(p_pickup_location),
    nullif(btrim(coalesce(p_message, '')), ''),
    NULL,
    NULL
  )
  ON CONFLICT (reservation_id) DO UPDATE SET
    pickup_at = EXCLUDED.pickup_at,
    pickup_location = EXCLUDED.pickup_location,
    message = EXCLUDED.message,
    driver_user_id = EXCLUDED.driver_user_id,
    recipient_user_id = EXCLUDED.recipient_user_id,
    confirmed_at = NULL,
    confirmed_by = NULL;

  RETURN p_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_carpool_pickup_details(uuid, timestamptz, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_carpool_pickup_details(uuid, timestamptz, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_event_carpool_pickup(
  p_reservation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_team_id uuid;
  v_kind text;
  v_player_id uuid;
  v_driver_user_id uuid;
  v_recipient_user_id uuid;
  v_player_first_name text;
  v_player_last_name text;
  v_family_name text;
  v_player_name text;
  v_already_confirmed boolean;
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich.';
  END IF;

  SELECT
    d.event_id,
    d.player_id,
    d.driver_user_id,
    d.recipient_user_id,
    d.confirmed_at IS NOT NULL,
    p.first_name,
    p.last_name,
    ts.team_id,
    CASE WHEN e.kind = 'match' THEN 'match'
         WHEN e.kind = 'training' THEN 'training'
         ELSE 'event' END
    INTO
      v_event_id, v_player_id, v_driver_user_id, v_recipient_user_id,
      v_already_confirmed, v_player_first_name, v_player_last_name,
      v_team_id, v_kind
  FROM public.event_carpool_pickup_details d
  JOIN public.players p ON p.id = d.player_id
  JOIN public.events e ON e.id = d.event_id
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  WHERE d.reservation_id = p_reservation_id
  FOR UPDATE OF d;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Abholvereinbarung wurde nicht gefunden.';
  END IF;

  SELECT
    auth.uid() = v_recipient_user_id
    OR EXISTS (
      SELECT 1
      FROM public.player_guardians pg
      WHERE pg.player_id = v_player_id
        AND pg.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.player_users pu
      WHERE pu.player_id = v_player_id
        AND pu.user_id = auth.uid()
    )
    INTO v_allowed;

  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'Nur die verknüpfte Familie kann die Abholung bestätigen.';
  END IF;

  IF v_already_confirmed THEN
    RETURN p_reservation_id;
  END IF;

  UPDATE public.event_carpool_pickup_details
  SET confirmed_at = now(), confirmed_by = auth.uid()
  WHERE reservation_id = p_reservation_id;

  v_family_name := CASE
    WHEN nullif(btrim(coalesce(v_player_last_name, '')), '') IS NOT NULL
      THEN 'Familie ' || btrim(v_player_last_name)
    ELSE 'Die Familie'
  END;
  v_player_name := coalesce(
    nullif(btrim(concat_ws(' ', v_player_first_name, v_player_last_name)), ''),
    'das Kind'
  );

  IF v_team_id IS NOT NULL AND v_driver_user_id IS NOT NULL THEN
    INSERT INTO public.notification_jobs (
      event_id, team_id, kind, send_at, payload, status, dedupe_key
    ) VALUES (
      v_event_id,
      v_team_id,
      v_kind,
      now(),
      jsonb_build_object(
        'automation', 'carpool',
        'pushTitle', 'Abholung bestätigt',
        'pushBody', v_family_name || ' hat die Abholung von ' || v_player_name || ' bestätigt.',
        'linkPath', '/app/events/' || v_event_id::text,
        'recipientUserIds', jsonb_build_array(v_driver_user_id)
      ),
      'pending',
      'carpool-pickup-confirmed:' || p_reservation_id::text || ':' || gen_random_uuid()::text
    );
  END IF;

  RETURN p_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_event_carpool_pickup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_event_carpool_pickup(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
