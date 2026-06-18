-- Status „krank“ (kurzfristige Erkrankung) + Mannschaftsbeteiligung pro Trainingseinheit.

ALTER TABLE public.event_attendance
  DROP CONSTRAINT IF EXISTS event_attendance_status_check;

ALTER TABLE public.event_attendance
  ADD CONSTRAINT event_attendance_status_check
  CHECK (status IN ('yes', 'no', 'maybe', 'sick', 'injured', 'external_training'));

COMMENT ON COLUMN public.event_attendance.status IS
  'yes=dabei, no=abwesend, sick=krank, injured=verletzt, external_training=LAZ/extern, maybe=legacy. Fehlende Zeile: offen (zukünftig) bzw. nicht erfasst (vergangen).';

-- Ø Mannschaftsbeteiligung = Durchschnitt der Einheiten-Quoten yes/(yes+no) über alle Trainings mit Basis.
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

      IF v_status = 'yes' THEN
        v_present := v_present + 1;
      ELSIF v_status = 'no' THEN
        v_absent := v_absent + 1;
      END IF;
      -- sick, injured, external_training, maybe, fehlend: neutral
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
  'Ø Mannschaftsbeteiligung: Durchschnitt der Trainings-Quoten yes/(yes+no). Krank, Verletzt, LAZ und fehlende Zeilen sind neutral.';

SELECT pg_notify('pgrst', 'reload schema');
