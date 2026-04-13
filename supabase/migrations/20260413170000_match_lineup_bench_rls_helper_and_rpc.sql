-- 1) Staff-Schreibberechtigung ohne verschachtelte matches-RLS in EXISTS-Subqueries
--    (sonst kann INSERT/UPSERT auf match_lineup scheitern, obwohl Trainer eingetragen ist).
-- 2) Atomare Ersetzung von lineup + bench in einer Transaktion (RPC).

CREATE OR REPLACE FUNCTION public.match_staff_can_write_for_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
 OR EXISTS (
    SELECT 1
    FROM public.matches m
    INNER JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
    WHERE m.id = p_match_id
      AND ms.user_id = auth.uid()
      AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
  );
$$;

COMMENT ON FUNCTION public.match_staff_can_write_for_match(uuid) IS
  'True wenn aktueller User Staff fuer die team_season des Matches ist (SECURITY DEFINER, um RLS auf matches bei Policy-Checks zu umgehen).';

GRANT EXECUTE ON FUNCTION public.match_staff_can_write_for_match(uuid) TO authenticated;

-- ----- match_lineup -----
DROP POLICY IF EXISTS match_lineup_insert_staff ON public.match_lineup;
CREATE POLICY match_lineup_insert_staff ON public.match_lineup
  FOR INSERT TO authenticated
  WITH CHECK (public.match_staff_can_write_for_match(match_lineup.match_id));

DROP POLICY IF EXISTS match_lineup_update_staff ON public.match_lineup;
CREATE POLICY match_lineup_update_staff ON public.match_lineup
  FOR UPDATE TO authenticated
  USING (public.match_staff_can_write_for_match(match_lineup.match_id))
  WITH CHECK (public.match_staff_can_write_for_match(match_lineup.match_id));

DROP POLICY IF EXISTS match_lineup_delete_staff ON public.match_lineup;
CREATE POLICY match_lineup_delete_staff ON public.match_lineup
  FOR DELETE TO authenticated
  USING (public.match_staff_can_write_for_match(match_lineup.match_id));

-- ----- match_bench -----
DROP POLICY IF EXISTS match_bench_insert_staff ON public.match_bench;
CREATE POLICY match_bench_insert_staff ON public.match_bench
  FOR INSERT TO authenticated
  WITH CHECK (public.match_staff_can_write_for_match(match_bench.match_id));

DROP POLICY IF EXISTS match_bench_update_staff ON public.match_bench;
CREATE POLICY match_bench_update_staff ON public.match_bench
  FOR UPDATE TO authenticated
  USING (public.match_staff_can_write_for_match(match_bench.match_id))
  WITH CHECK (public.match_staff_can_write_for_match(match_bench.match_id));

DROP POLICY IF EXISTS match_bench_delete_staff ON public.match_bench;
CREATE POLICY match_bench_delete_staff ON public.match_bench
  FOR DELETE TO authenticated
  USING (public.match_staff_can_write_for_match(match_bench.match_id));

-- Atomar: lineup + bench ersetzen (ein RPC = eine Transaktion)
CREATE OR REPLACE FUNCTION public.replace_match_lineup_and_bench(
  p_match_id uuid,
  p_lineup jsonb,
  p_bench_player_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.match_staff_can_write_for_match(p_match_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = p_match_id) THEN
    RAISE EXCEPTION 'match not found';
  END IF;

  DELETE FROM public.match_lineup WHERE match_id = p_match_id;

  INSERT INTO public.match_lineup (match_id, slot, player_id)
  SELECT
    p_match_id,
    (elem->>'slot')::text,
    CASE
      WHEN elem->>'player_id' IS NOT NULL AND btrim(elem->>'player_id') <> ''
      THEN (elem->>'player_id')::uuid
      ELSE NULL
    END
  FROM jsonb_array_elements(p_lineup) AS elem;

  DELETE FROM public.match_bench WHERE match_id = p_match_id;

  IF p_bench_player_ids IS NOT NULL AND coalesce(array_length(p_bench_player_ids, 1), 0) > 0 THEN
    INSERT INTO public.match_bench (match_id, player_id)
    SELECT p_match_id, bid
    FROM unnest(p_bench_player_ids) AS bid;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.replace_match_lineup_and_bench(uuid, jsonb, uuid[]) IS
  'Ersetzt match_lineup und match_bench fuer ein Match in einer Transaktion (nur Staff).';

GRANT EXECUTE ON FUNCTION public.replace_match_lineup_and_bench(uuid, jsonb, uuid[]) TO authenticated;
