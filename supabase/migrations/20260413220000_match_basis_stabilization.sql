-- Phase B: Match-Basis — atomare Bank-Ersetzung, Datenbereinigung (Test-/Fehldaten).

-- 1) Nur Bankersetzen (Kader speichern), eine Transaktion — gleiche Staff-Pruefung wie Lineup-RPC
CREATE OR REPLACE FUNCTION public.replace_match_bench_only(
  p_match_id uuid,
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

  DELETE FROM public.match_bench WHERE match_id = p_match_id;

  IF p_bench_player_ids IS NOT NULL AND coalesce(array_length(p_bench_player_ids, 1), 0) > 0 THEN
    INSERT INTO public.match_bench (match_id, player_id)
    SELECT p_match_id, bid
    FROM unnest(p_bench_player_ids) AS bid;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.replace_match_bench_only(uuid, uuid[]) IS
  'Ersetzt nur match_bench fuer ein Match (atomar, nur Staff).';

GRANT EXECUTE ON FUNCTION public.replace_match_bench_only(uuid, uuid[]) TO authenticated;

-- 2) Verwaiste Zeilen (kein matches-Eintrag mehr)
DELETE FROM public.match_lineup ml
WHERE NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = ml.match_id);

DELETE FROM public.match_bench mb
WHERE NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = mb.match_id);

DELETE FROM public.match_events me
WHERE NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = me.match_id);

-- 3) Duplikate: pro (match_id, slot) bzw. (match_id, player_id) eine Zeile behalten
DELETE FROM public.match_lineup ml
WHERE ml.ctid NOT IN (
  SELECT MIN(sub.ctid)
  FROM public.match_lineup sub
  GROUP BY sub.match_id, sub.slot
);

DELETE FROM public.match_bench mb
WHERE mb.ctid NOT IN (
  SELECT MIN(sub.ctid)
  FROM public.match_bench sub
  GROUP BY sub.match_id, sub.player_id
);
