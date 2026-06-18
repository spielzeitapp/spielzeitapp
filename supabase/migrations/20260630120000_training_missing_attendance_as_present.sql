-- Training: fehlende Attendance bei vergangenen Einheiten = Dabei (yes).
-- Kein „offen“ / „nicht erfasst“ in Statistik; Backfill + RPC an Client-Logik angeglichen.

COMMENT ON COLUMN public.event_attendance.status IS
  'yes=dabei, no=abwesend, sick=krank, injured=verletzt, external_training=LAZ. Fehlende Zeile bei vergangenem Training gilt als yes.';

-- Legacy maybe → yes für abgeschlossene Trainings
UPDATE public.event_attendance ea
SET status = 'yes',
    updated_at = now()
FROM public.events e
WHERE ea.event_id = e.id
  AND e.kind = 'training'
  AND e.starts_at < now()
  AND coalesce(e.status, '') NOT IN ('canceled', 'cancelled', 'deleted', 'archived')
  AND ea.status = 'maybe';

-- Fehlende Zeilen für aktive Spieler bei vergangenen Trainings ergänzen
INSERT INTO public.event_attendance (event_id, player_id, status)
SELECT e.id,
       p.id,
       'yes'
FROM public.events e
INNER JOIN public.players p ON p.team_season_id = e.team_season_id
WHERE e.kind = 'training'
  AND e.starts_at < now()
  AND coalesce(e.status, '') NOT IN ('canceled', 'cancelled', 'deleted', 'archived')
  AND coalesce(p.status, 'active') = 'active'
  AND coalesce(p.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.event_attendance ea
    WHERE ea.event_id = e.id
      AND ea.player_id = p.id
  )
ON CONFLICT (event_id, player_id) DO NOTHING;

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
  v_absent integer;
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
    v_absent := 0;

    FOR v_player IN
      SELECT p.id
      FROM public.players p
      WHERE p.team_season_id = p_team_season_id
        AND coalesce(p.status, 'active') = 'active'
        AND coalesce(p.is_active, true) = true
    LOOP
      SELECT ea.status
      INTO v_raw
      FROM public.event_attendance ea
      WHERE ea.event_id = v_event.id
        AND ea.player_id = v_player.id
      LIMIT 1;

      v_status := lower(trim(coalesce(v_raw, '')));

      IF v_status = 'no' THEN
        v_absent := v_absent + 1;
      ELSIF v_status NOT IN ('sick', 'injured', 'external_training') THEN
        -- yes, maybe, leer/fehlend → Dabei
        v_present := v_present + 1;
      END IF;
      -- sick, injured, external_training: neutral
    END LOOP;

    IF v_present + v_absent > 0 THEN
      v_session_rates := array_append(
        v_session_rates,
        round((v_present::numeric / (v_present + v_absent)::numeric) * 100)
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
  'Ø Beteiligung: Durchschnitt yes/(yes+no) je Training. Fehlende Zeilen = yes. Krank, Verletzt, LAZ neutral.';

SELECT pg_notify('pgrst', 'reload schema');
