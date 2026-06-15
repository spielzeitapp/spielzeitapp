-- Ø Beteiligung gewerteter Spieler (teamRatePct yes/(yes+no), ≥30 % Trainingsbasis).
-- SECURITY DEFINER: Eltern sehen denselben Mannschaftswert wie Staff ohne fremde event_attendance-Zeilen.

CREATE OR REPLACE FUNCTION public.get_team_training_participation_pct(p_team_season_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_now timestamptz := now();
  v_sessions integer := 0;
  v_min_basis integer := 0;
  v_team_rates numeric[] := ARRAY[]::numeric[];
  v_player record;
  v_event record;
  v_present integer;
  v_absent integer;
  v_external integer;
  v_valuable integer;
  v_denom integer;
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

  SELECT count(*)::integer
  INTO v_sessions
  FROM public.events e
  WHERE e.team_season_id = p_team_season_id
    AND e.kind = 'training'
    AND e.starts_at < v_now
    AND coalesce(e.status, '') NOT IN ('canceled', 'cancelled', 'deleted', 'archived');

  IF v_sessions <= 0 THEN
    RETURN NULL;
  END IF;

  v_min_basis := ceil(v_sessions * 0.3)::integer;

  FOR v_player IN
    SELECT p.id
    FROM public.players p
    WHERE p.team_season_id = p_team_season_id
      AND coalesce(p.status, 'active') = 'active'
      AND coalesce(p.is_active, true) = true
  LOOP
    v_present := 0;
    v_absent := 0;
    v_external := 0;

    FOR v_event IN
      SELECT e.id, e.starts_at
      FROM public.events e
      WHERE e.team_season_id = p_team_season_id
        AND e.kind = 'training'
        AND e.starts_at < v_now
        AND coalesce(e.status, '') NOT IN ('canceled', 'cancelled', 'deleted', 'archived')
    LOOP
      SELECT ea.status
      INTO v_raw
      FROM public.event_attendance ea
      WHERE ea.event_id = v_event.id
        AND ea.player_id = v_player.id
      LIMIT 1;

      v_status := lower(trim(coalesce(v_raw, '')));

      IF v_status = 'yes' THEN
        v_present := v_present + 1;
      ELSIF v_status = 'no' THEN
        v_absent := v_absent + 1;
      ELSIF v_status = 'external_training' THEN
        v_external := v_external + 1;
      ELSIF v_status IN ('', 'maybe') OR v_raw IS NULL THEN
        IF v_event.starts_at < v_now THEN
          v_present := v_present + 1;
        END IF;
      END IF;
      -- injured, open: nicht im Nenner (yes + no)
    END LOOP;

    v_valuable := v_present + v_external + v_absent;
    v_denom := v_present + v_absent;

    IF v_valuable >= v_min_basis AND v_denom > 0 THEN
      v_team_rates := array_append(
        v_team_rates,
        round((v_present::numeric / v_denom::numeric) * 100)
      );
    END IF;
  END LOOP;

  IF coalesce(array_length(v_team_rates, 1), 0) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN round((SELECT avg(x) FROM unnest(v_team_rates) AS x))::integer;
END;
$$;

COMMENT ON FUNCTION public.get_team_training_participation_pct(uuid) IS
  'Ø Beteiligung gewerteter Spieler (teamRatePct, ≥30 % Basis). Für alle Team-Mitglieder ohne fremde Einzelzeilen.';

GRANT EXECUTE ON FUNCTION public.get_team_training_participation_pct(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
