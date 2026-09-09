-- Push-/Inbox-Kommunikation fuer neue und erledigte Mitfahrplatzgesuche.

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

DROP TRIGGER IF EXISTS trg_event_carpool_request_notification
  ON public.event_carpool_requests;
CREATE TRIGGER trg_event_carpool_request_notification
  AFTER INSERT OR DELETE ON public.event_carpool_requests
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_event_carpool_request_notification();

SELECT pg_notify('pgrst', 'reload schema');
