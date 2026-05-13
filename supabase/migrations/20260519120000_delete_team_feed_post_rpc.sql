-- Zuverlässiges Löschen von team_feed_posts: Client-DELETE kann bei RLS 0 Zeilen liefern ohne Fehler.
-- RPC als SECURITY DEFINER mit gleicher Staff-Prüfung wie INSERT (can_insert_team_feed_post).

CREATE OR REPLACE FUNCTION public.delete_team_feed_post(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts uuid;
  v_deleted int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id INTO v_ts
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  END IF;

  IF NOT public.can_insert_team_feed_post(v_ts) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'already_gone');
  END IF;

  RETURN json_build_object('ok', true, 'deleted', true);
END;
$$;

COMMENT ON FUNCTION public.delete_team_feed_post(uuid) IS
  'Löscht einen Feed-Post wenn auth.uid() Staff/Admin für team_season_id ist (can_insert_team_feed_post). Idempotent bei fehlender Zeile.';

REVOKE ALL ON FUNCTION public.delete_team_feed_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_team_feed_post(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
