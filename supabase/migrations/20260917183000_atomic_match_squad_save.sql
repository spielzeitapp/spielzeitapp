-- Kader atomar speichern, ohne match_lineup kurzzeitig zu leeren.
-- Verhindert Realtime-Repair-Races und duplicate match_lineup_pkey Fehler.

CREATE OR REPLACE FUNCTION public.save_match_squad_only(
  p_match_id uuid,
  p_player_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_team_season_id uuid;
  v_player_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT m.team_season_id
  INTO v_team_season_id
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_team_season_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_not_found');
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships ms
      WHERE ms.team_season_id = v_team_season_id
        AND ms.user_id = v_uid
        AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT coalesce(array_agg(DISTINCT player_id), ARRAY[]::uuid[])
  INTO v_player_ids
  FROM unnest(coalesce(p_player_ids, ARRAY[]::uuid[])) AS selected(player_id)
  WHERE player_id IS NOT NULL;

  IF coalesce(array_length(v_player_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_squad');
  END IF;

  -- Nicht nominierte Spieler aus der bestehenden Startaufstellung entfernen.
  DELETE FROM public.match_lineup ml
  WHERE ml.match_id = p_match_id
    AND (ml.player_id IS NULL OR NOT (ml.player_id = ANY(v_player_ids)));

  -- Bank exakt mit dem Kader synchronisieren; Startelfspieler gehoeren nicht auf die Bank.
  DELETE FROM public.match_bench mb
  WHERE mb.match_id = p_match_id
    AND (
      NOT (mb.player_id = ANY(v_player_ids))
      OR EXISTS (
        SELECT 1
        FROM public.match_lineup ml
        WHERE ml.match_id = p_match_id
          AND ml.player_id = mb.player_id
      )
    );

  INSERT INTO public.match_bench (match_id, player_id)
  SELECT p_match_id, selected.player_id
  FROM unnest(v_player_ids) AS selected(player_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.match_lineup ml
    WHERE ml.match_id = p_match_id
      AND ml.player_id = selected.player_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.match_bench mb
    WHERE mb.match_id = p_match_id
      AND mb.player_id = selected.player_id
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'squad_count', coalesce(array_length(v_player_ids, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_match_squad_only(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_match_squad_only(uuid, uuid[]) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
