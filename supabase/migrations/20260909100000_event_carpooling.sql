-- Fahrgemeinschaften pro Termin: Angebote, Reservierungen und Platzgesuche.
-- Kapazitaet und eindeutige Zuordnung je Kind werden in der DB abgesichert.

CREATE TABLE IF NOT EXISTS public.event_carpool_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_name text NOT NULL CHECK (char_length(btrim(driver_name)) BETWEEN 1 AND 120),
  departure_at timestamptz NOT NULL,
  departure_location text NOT NULL CHECK (char_length(btrim(departure_location)) BETWEEN 1 AND 240),
  seat_count integer NOT NULL CHECK (seat_count BETWEEN 1 AND 12),
  return_included boolean NOT NULL DEFAULT true,
  note text NULL CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, driver_user_id)
);

CREATE TABLE IF NOT EXISTS public.event_carpool_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.event_carpool_offers(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  reserved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, player_id),
  UNIQUE (offer_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.event_carpool_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS event_carpool_offers_event_idx
  ON public.event_carpool_offers(event_id, departure_at);
CREATE INDEX IF NOT EXISTS event_carpool_reservations_offer_idx
  ON public.event_carpool_reservations(offer_id);
CREATE INDEX IF NOT EXISTS event_carpool_requests_event_idx
  ON public.event_carpool_requests(event_id);

DROP TRIGGER IF EXISTS trg_event_carpool_offers_updated_at ON public.event_carpool_offers;
CREATE TRIGGER trg_event_carpool_offers_updated_at
  BEFORE UPDATE ON public.event_carpool_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.carpool_can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.memberships m ON m.team_season_id = e.team_season_id
    WHERE e.id = p_event_id
      AND m.user_id = auth.uid()
      AND lower(m.role::text) IN ('parent', 'player', 'trainer', 'co_trainer', 'head_coach', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.carpool_can_manage_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.memberships m ON m.team_season_id = e.team_season_id
    WHERE e.id = p_event_id
      AND m.user_id = auth.uid()
      AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.carpool_can_use_player(p_event_id uuid, p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = p_event_id
        AND public.player_in_team_season(p_player_id, e.team_season_id)
    )
    AND (
      public.carpool_can_manage_event(p_event_id)
      OR EXISTS (
        SELECT 1 FROM public.player_guardians pg
        WHERE pg.user_id = auth.uid() AND pg.player_id = p_player_id
      )
      OR EXISTS (
        SELECT 1 FROM public.player_users pu
        WHERE pu.user_id = auth.uid() AND pu.player_id = p_player_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.carpool_can_access_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carpool_can_manage_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.carpool_can_use_player(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.carpool_can_access_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.carpool_can_manage_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.carpool_can_use_player(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_event_carpool_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_event uuid;
  v_seat_count integer;
  v_reserved integer;
BEGIN
  SELECT o.event_id, o.seat_count
    INTO v_offer_event, v_seat_count
  FROM public.event_carpool_offers o
  WHERE o.id = NEW.offer_id
  FOR UPDATE;

  IF v_offer_event IS NULL OR NEW.event_id <> v_offer_event THEN
    RAISE EXCEPTION 'Das Fahrangebot gehört nicht zu diesem Termin.';
  END IF;

  IF NOT public.carpool_can_use_player(NEW.event_id, NEW.player_id) THEN
    RAISE EXCEPTION 'Für dieses Kind darf kein Platz reserviert werden.';
  END IF;

  SELECT count(*) INTO v_reserved
  FROM public.event_carpool_reservations r
  WHERE r.offer_id = NEW.offer_id
    AND (TG_OP = 'INSERT' OR r.id <> NEW.id);

  IF v_reserved >= v_seat_count THEN
    RAISE EXCEPTION 'Diese Fahrgemeinschaft ist bereits voll.';
  END IF;

  NEW.reserved_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_event_carpool_reservation ON public.event_carpool_reservations;
CREATE TRIGGER trg_validate_event_carpool_reservation
  BEFORE INSERT OR UPDATE ON public.event_carpool_reservations
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_carpool_reservation();

CREATE OR REPLACE FUNCTION public.validate_event_carpool_offer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved integer;
BEGIN
  IF NEW.event_id <> OLD.event_id OR NEW.driver_user_id <> OLD.driver_user_id THEN
    RAISE EXCEPTION 'Termin und Fahrer können nicht geändert werden.';
  END IF;
  SELECT count(*) INTO v_reserved
  FROM public.event_carpool_reservations r
  WHERE r.offer_id = OLD.id;
  IF NEW.seat_count < v_reserved THEN
    RAISE EXCEPTION 'Es sind bereits mehr Plätze reserviert.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_event_carpool_offer_update ON public.event_carpool_offers;
CREATE TRIGGER trg_validate_event_carpool_offer_update
  BEFORE UPDATE ON public.event_carpool_offers
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_carpool_offer_update();

ALTER TABLE public.event_carpool_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpool_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_carpool_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_carpool_offers_select_team ON public.event_carpool_offers;
CREATE POLICY event_carpool_offers_select_team
  ON public.event_carpool_offers FOR SELECT TO authenticated
  USING (public.carpool_can_access_event(event_id));
DROP POLICY IF EXISTS event_carpool_offers_insert_own ON public.event_carpool_offers;
CREATE POLICY event_carpool_offers_insert_own
  ON public.event_carpool_offers FOR INSERT TO authenticated
  WITH CHECK (
    driver_user_id = auth.uid()
    AND public.carpool_can_access_event(event_id)
  );
DROP POLICY IF EXISTS event_carpool_offers_update_own ON public.event_carpool_offers;
CREATE POLICY event_carpool_offers_update_own
  ON public.event_carpool_offers FOR UPDATE TO authenticated
  USING (driver_user_id = auth.uid() OR public.carpool_can_manage_event(event_id))
  WITH CHECK (driver_user_id = auth.uid() OR public.carpool_can_manage_event(event_id));
DROP POLICY IF EXISTS event_carpool_offers_delete_own ON public.event_carpool_offers;
CREATE POLICY event_carpool_offers_delete_own
  ON public.event_carpool_offers FOR DELETE TO authenticated
  USING (driver_user_id = auth.uid() OR public.carpool_can_manage_event(event_id));

DROP POLICY IF EXISTS event_carpool_reservations_select_team ON public.event_carpool_reservations;
CREATE POLICY event_carpool_reservations_select_team
  ON public.event_carpool_reservations FOR SELECT TO authenticated
  USING (public.carpool_can_access_event(event_id));
DROP POLICY IF EXISTS event_carpool_reservations_insert_own_player ON public.event_carpool_reservations;
CREATE POLICY event_carpool_reservations_insert_own_player
  ON public.event_carpool_reservations FOR INSERT TO authenticated
  WITH CHECK (reserved_by = auth.uid() AND public.carpool_can_use_player(event_id, player_id));
DROP POLICY IF EXISTS event_carpool_reservations_delete_own_player ON public.event_carpool_reservations;
CREATE POLICY event_carpool_reservations_delete_own_player
  ON public.event_carpool_reservations FOR DELETE TO authenticated
  USING (
    reserved_by = auth.uid()
    OR public.carpool_can_use_player(event_id, player_id)
    OR public.carpool_can_manage_event(event_id)
  );

DROP POLICY IF EXISTS event_carpool_requests_select_team ON public.event_carpool_requests;
CREATE POLICY event_carpool_requests_select_team
  ON public.event_carpool_requests FOR SELECT TO authenticated
  USING (public.carpool_can_access_event(event_id));
DROP POLICY IF EXISTS event_carpool_requests_insert_own_player ON public.event_carpool_requests;
CREATE POLICY event_carpool_requests_insert_own_player
  ON public.event_carpool_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.carpool_can_use_player(event_id, player_id));
DROP POLICY IF EXISTS event_carpool_requests_delete_own_player ON public.event_carpool_requests;
CREATE POLICY event_carpool_requests_delete_own_player
  ON public.event_carpool_requests FOR DELETE TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.carpool_can_use_player(event_id, player_id)
    OR public.carpool_can_manage_event(event_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_carpool_offers TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.event_carpool_reservations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.event_carpool_requests TO authenticated;

-- Sofortige Push-/Inbox-Jobs ueber die bestehende Reminder-Pipeline.
-- Neue Fahrt: Eltern/Spieler des Teams. Aenderung/Loeschung: nur reservierte Familien.
-- Reservierung: Fahrer der Fahrt.
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
  v_player_name text;
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
    ELSE
      v_event_id := NEW.event_id;
      v_offer_id := NEW.offer_id;
    END IF;
    SELECT o.driver_user_id INTO v_driver_id
    FROM public.event_carpool_offers o WHERE o.id = v_offer_id;
    SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Ein Kind')
      INTO v_player_name
    FROM public.players p
    WHERE p.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.player_id ELSE NEW.player_id END;
    IF TG_OP = 'INSERT' THEN
      v_title := 'Mitfahrplatz reserviert';
      v_body := coalesce(v_player_name, 'Ein Kind') || ' wurde für deine Fahrt eingetragen.';
    ELSE
      v_title := 'Mitfahrplatz freigegeben';
      v_body := coalesce(v_player_name, 'Ein Kind') || ' fährt nicht mehr bei dir mit.';
    END IF;
    IF v_driver_id IS NOT NULL AND v_driver_id <> auth.uid() THEN
      v_recipients := ARRAY[v_driver_id];
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

DROP TRIGGER IF EXISTS trg_event_carpool_offer_notification ON public.event_carpool_offers;
CREATE TRIGGER trg_event_carpool_offer_notification
  AFTER INSERT OR UPDATE OR DELETE ON public.event_carpool_offers
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_event_carpool_notification();

DROP TRIGGER IF EXISTS trg_event_carpool_reservation_notification ON public.event_carpool_reservations;
CREATE TRIGGER trg_event_carpool_reservation_notification
  AFTER INSERT OR DELETE ON public.event_carpool_reservations
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_event_carpool_notification();

SELECT pg_notify('pgrst', 'reload schema');
