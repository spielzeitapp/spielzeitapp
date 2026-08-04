-- STEP 7C.1 – Team-Feed-Chronik über Saisons + Auto-Post-Suppression vollständig
-- NICHT automatisch anwenden: User führt manuell auf Staging/Live aus.

-- ---------------------------------------------------------------------------
-- Index für Team-Chronik-Query
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_team_feed_posts_team_created
  ON public.team_feed_posts (team_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- SELECT: Mitglieder jeder Saison desselben Teams sehen die Team-Chronik
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "team_feed_posts_select_members" ON public.team_feed_posts;
CREATE POLICY "team_feed_posts_select_members"
  ON public.team_feed_posts
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      JOIN public.team_seasons ts_mem ON ts_mem.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts_mem.team_id = team_feed_posts.team_id
    )
  );

COMMENT ON POLICY "team_feed_posts_select_members" ON public.team_feed_posts IS
  'Mitglieder einer beliebigen team_season desselben team_id (oder Admin) dürfen Feed lesen.';

-- ---------------------------------------------------------------------------
-- DELETE-Recht: Staff auf irgendeiner Saison desselben Teams
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_delete_team_feed_post(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.team_seasons ts_post
      JOIN public.team_seasons ts_mem ON ts_mem.team_id = ts_post.team_id
      JOIN public.memberships m ON m.team_season_id = ts_mem.id
      WHERE ts_post.id = p_team_season_id
        AND m.user_id = auth.uid()
        AND m.role IN (
          'trainer'::public.membership_role,
          'co_trainer'::public.membership_role,
          'head_coach'::public.membership_role
        )
    );
$$;

COMMENT ON FUNCTION public.can_delete_team_feed_post(uuid) IS
  'True if auth.uid() may DELETE team_feed_posts for the team of p_team_season_id (staff on any season of that team, or admin).';

-- ---------------------------------------------------------------------------
-- Suppressions: Client-Ensures dürfen lesen (sonst Recreation nach Delete)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.team_feed_dedupe_suppressions TO authenticated;

DROP POLICY IF EXISTS "team_feed_dedupe_suppressions_select_auth" ON public.team_feed_dedupe_suppressions;
CREATE POLICY "team_feed_dedupe_suppressions_select_auth"
  ON public.team_feed_dedupe_suppressions
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Delete RPC: JEDEN non-null dedupe_key suppressen (alle Auto-Kinds)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_team_feed_post(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts uuid;
  v_dedupe text;
  v_deleted int;
  v_suppression_written boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id, t.dedupe_key
  INTO v_ts, v_dedupe
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'not_found',
      'dedupe_key_found', NULL,
      'suppression_written', false
    );
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'forbidden',
      'dedupe_key_found', v_dedupe,
      'suppression_written', false
    );
  END IF;

  IF v_dedupe IS NOT NULL AND btrim(v_dedupe) <> '' THEN
    INSERT INTO public.team_feed_dedupe_suppressions (dedupe_key, team_season_id, suppressed_by)
    VALUES (v_dedupe, v_ts, v_uid)
    ON CONFLICT (dedupe_key) DO UPDATE SET
      team_season_id = EXCLUDED.team_season_id,
      suppressed_at = now(),
      suppressed_by = EXCLUDED.suppressed_by;
    v_suppression_written := true;
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'already_gone',
      'dedupe_key_found', v_dedupe,
      'suppression_written', v_suppression_written
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'deleted', true,
    'dedupe_key_found', v_dedupe,
    'suppression_written', v_suppression_written
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_team_feed_post_v2(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts uuid;
  v_dedupe text;
  v_deleted int;
  v_suppression_written boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id, t.dedupe_key
  INTO v_ts, v_dedupe
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'not_found',
      'dedupe_key_found', NULL,
      'suppression_written', false
    );
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'forbidden',
      'dedupe_key_found', v_dedupe,
      'suppression_written', false
    );
  END IF;

  IF v_dedupe IS NOT NULL AND btrim(v_dedupe) <> '' THEN
    INSERT INTO public.team_feed_dedupe_suppressions (dedupe_key, team_season_id, suppressed_by)
    VALUES (v_dedupe, v_ts, v_uid)
    ON CONFLICT (dedupe_key) DO UPDATE SET
      team_season_id = EXCLUDED.team_season_id,
      suppressed_at = now(),
      suppressed_by = EXCLUDED.suppressed_by;
    v_suppression_written := true;
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'already_gone',
      'dedupe_key_found', v_dedupe,
      'suppression_written', v_suppression_written
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'deleted', true,
    'dedupe_key_found', v_dedupe,
    'suppression_written', v_suppression_written
  );
END;
$$;

COMMENT ON FUNCTION public.delete_team_feed_post(uuid) IS
  'Löscht Feed-Post; schreibt immer dedupe_key in team_feed_dedupe_suppressions (kein Sofort-Recreate).';
COMMENT ON FUNCTION public.delete_team_feed_post_v2(uuid) IS
  'Löscht Feed-Post; schreibt immer dedupe_key in team_feed_dedupe_suppressions (kein Sofort-Recreate).';
