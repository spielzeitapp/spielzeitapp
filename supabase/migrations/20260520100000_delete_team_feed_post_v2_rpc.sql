-- delete_team_feed_post_v2: neuer RPC-Name um PostgREST/Schema-Cache und 400er durch veraltete Signatur zu vermeiden.
-- Berechtigung: Staff für team_season_id (can_insert_team_feed_post) oder System-Admin (is_admin; auch in can_insert enthalten, explizit OR).

CREATE OR REPLACE FUNCTION public.delete_team_feed_post_v2(p_post_id uuid)
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

  IF NOT (
    public.can_insert_team_feed_post(v_ts)
    OR public.is_admin()
  ) THEN
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

COMMENT ON FUNCTION public.delete_team_feed_post_v2(uuid) IS
  'Löscht team_feed_posts.id = p_post_id wenn can_insert_team_feed_post(team_season_id) oder is_admin(). Idempotent: not_found / already_gone.';

REVOKE ALL ON FUNCTION public.delete_team_feed_post_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_team_feed_post_v2(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
