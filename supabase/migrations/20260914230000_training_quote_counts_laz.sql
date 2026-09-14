-- Trainingsquote misst die Teilnahme am Vereinstraining.
-- LAZ ist eine wertbare Alternative (für Aktivität positiv), aber keine Teilnahme
-- am gleichzeitig angesetzten Vereinstraining. Krank und verletzt bleiben neutral.

CREATE OR REPLACE FUNCTION public.get_team_training_participation_pct(p_team_season_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_now timestamptz := now();
  v_session_rates numeric[] := ARRAY[]::numeric[];
  v_event record;
  v_player record;
  v_present integer;
  v_not_at_club integer;
  v_raw text;
  v_status text;
BEGIN
  IF p_team_season_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships ms
    WHERE ms.team_season_id = p_team_season_id
      AND ms.user_id = auth.uid()
  ) THEN
    RETURN NULL;
  END IF;

  FOR v_event IN
    SELECT e.id, e.starts_at
    FROM public.events e
    WHERE e.team_season_id = p_team_season_id
      AND e.kind = 'training'
      AND e.starts_at < v_now
      AND coalesce(e.status, '') NOT IN ('canceled', 'cancelled', 'deleted', 'archived')
    ORDER BY e.starts_at ASC
  LOOP
    v_present := 0;
    v_not_at_club := 0;

    FOR v_player IN
      SELECT tsp.player_id AS id
      FROM public.team_season_players tsp
      WHERE tsp.team_season_id = p_team_season_id
        AND tsp.left_at IS NULL
        AND coalesce(tsp.status, 'active') = 'active'
        AND coalesce(tsp.is_active, true) = true
    LOOP
      SELECT ea.status
      INTO v_raw
      FROM public.event_attendance ea
      WHERE ea.event_id = v_event.id
        AND ea.player_id = v_player.id
      LIMIT 1;

      v_status := lower(trim(coalesce(v_raw, '')));

      IF v_status IN ('no', 'external_training') THEN
        v_not_at_club := v_not_at_club + 1;
      ELSIF v_status NOT IN ('sick', 'injured') THEN
        -- yes, maybe und fehlende Zeile gelten bei vergangenen Trainings als dabei.
        v_present := v_present + 1;
      END IF;
    END LOOP;

    IF v_present + v_not_at_club > 0 THEN
      v_session_rates := array_append(
        v_session_rates,
        round((v_present::numeric / (v_present + v_not_at_club)::numeric) * 100)
      );
    END IF;
  END LOOP;

  IF coalesce(array_length(v_session_rates, 1), 0) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN round((SELECT avg(x) FROM unnest(v_session_rates) AS x))::integer;
END;
$$;

COMMENT ON FUNCTION public.get_team_training_participation_pct(uuid) IS
  'Ø Vereinstrainingsbeteiligung je Training. LAZ zählt zur Basis, Krank/Verletzt neutral.';

REVOKE ALL ON FUNCTION public.get_team_training_participation_pct(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_training_participation_pct(uuid) TO authenticated;
