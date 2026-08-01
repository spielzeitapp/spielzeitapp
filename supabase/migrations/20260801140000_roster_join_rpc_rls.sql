-- STEP 4B: RPC/RLS auf team_season_players (saisonfähiger Kader).
-- players.team_season_id bleibt als Compatibility-Spalte bestehen.
-- Keine destructive Changes. Nur Staging anwenden (nicht Live/main).
--
-- Inventar → neue Bedingung:
-- | Objekt                              | Alt                         | Neu                                      |
-- | get_team_training_participation_pct | players.team_season_id      | team_season_players                      |
-- | get_team_player_parent_links        | players.team_season_id      | team_season_players (+ Join-Felder)      |
-- | get_team_player_app_status          | players.team_season_id      | team_season_players                      |
-- | RSVP player policies                | p.team_season_id = e.ts     | player_in_team_season(p, e.ts)           |
-- | players Staff-RLS                   | ms.ts = players.ts          | ms.ts via team_season_players            |
-- | player_profiles coach               | m.ts = pl.ts                | m.ts via team_season_players             |
-- | Avatar/Cutout storage helper        | p.ts = path ts              | tsp (player, path ts)                    |
-- | can_manage_player_login             | staff of pl.team_season_id  | staff of any tsp.team_season_id          |

-- ---------------------------------------------------------------------------
-- 1) Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.player_in_team_season(
  p_player_id uuid,
  p_team_season_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_player_id IS NOT NULL
    AND p_team_season_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_season_players AS tsp
      WHERE tsp.player_id = p_player_id
        AND tsp.team_season_id = p_team_season_id
        AND tsp.left_at IS NULL
    );
$$;

COMMENT ON FUNCTION public.player_in_team_season(uuid, uuid) IS
  'True if player has an open roster row in team_season_players for the season.';

REVOKE ALL ON FUNCTION public.player_in_team_season(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_in_team_season(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_can_access_player(p_player_id uuid)
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
      FROM public.team_season_players AS tsp
      INNER JOIN public.memberships AS ms
        ON ms.team_season_id = tsp.team_season_id
      WHERE tsp.player_id = p_player_id
        AND tsp.left_at IS NULL
        AND ms.user_id = auth.uid()
        AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
    -- Compatibility: solange players.team_season_id gesetzt ist
    OR EXISTS (
      SELECT 1
      FROM public.players AS pl
      INNER JOIN public.memberships AS ms
        ON ms.team_season_id = pl.team_season_id
      WHERE pl.id = p_player_id
        AND pl.team_season_id IS NOT NULL
        AND ms.user_id = auth.uid()
        AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    );
$$;

COMMENT ON FUNCTION public.staff_can_access_player(uuid) IS
  'Staff access via team_season_players (preferred) or players.team_season_id (compat).';

REVOKE ALL ON FUNCTION public.staff_can_access_player(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_can_access_player(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Training participation %
-- ---------------------------------------------------------------------------

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

      IF v_status = 'no' THEN
        v_absent := v_absent + 1;
      ELSIF v_status NOT IN ('sick', 'injured', 'external_training') THEN
        v_present := v_present + 1;
      END IF;
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
  'Ø Beteiligung je Training. Kader aus team_season_players. Fehlende Attendance = yes.';

-- ---------------------------------------------------------------------------
-- 3) Parent links
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_team_player_parent_links(p_team_season_id uuid)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  jersey_number integer,
  status text,
  is_active boolean,
  parent_count integer,
  parents jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_team_season_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS player_id,
    coalesce(
      NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      'Spieler'
    ) AS player_name,
    tsp.jersey_number,
    coalesce(tsp.status, 'active')::text AS status,
    coalesce(tsp.is_active, true) AS is_active,
    count(pg.user_id)::integer AS parent_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', pg.user_id,
          'first_name', pr.first_name,
          'last_name', pr.last_name,
          'display_name', coalesce(
            NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
            NULLIF(
              trim(
                concat_ws(
                  ' ',
                  u.raw_user_meta_data ->> 'first_name',
                  u.raw_user_meta_data ->> 'last_name'
                )
              ),
              ''
            )
          ),
          'name', coalesce(
            NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
            NULLIF(
              trim(
                concat_ws(
                  ' ',
                  u.raw_user_meta_data ->> 'first_name',
                  u.raw_user_meta_data ->> 'last_name'
                )
              ),
              ''
            )
          ),
          'email', coalesce(
            NULLIF(trim(pr.email), ''),
            NULLIF(trim(u.email), '')
          ),
          'push_active', EXISTS (
            SELECT 1
            FROM public.push_subscriptions AS ps
            WHERE ps.user_id IS NOT NULL
              AND ps.user_id = pg.user_id
          ),
          'push_device_count', (
            SELECT count(*)::integer
            FROM public.push_subscriptions AS ps
            WHERE ps.user_id IS NOT NULL
              AND ps.user_id = pg.user_id
          )
        )
        ORDER BY pr.last_name NULLS LAST, pr.first_name NULLS LAST
      ) FILTER (WHERE pg.user_id IS NOT NULL),
      '[]'::jsonb
    ) AS parents
  FROM public.team_season_players AS tsp
  INNER JOIN public.players AS p ON p.id = tsp.player_id
  LEFT JOIN public.player_guardians AS pg ON pg.player_id = p.id
  LEFT JOIN public.profiles AS pr ON pr.id = pg.user_id
  LEFT JOIN auth.users AS u ON u.id = pg.user_id
  WHERE tsp.team_season_id = p_team_season_id
    AND tsp.left_at IS NULL
    AND coalesce(tsp.status, 'active') <> 'archived'
  GROUP BY
    p.id,
    p.first_name,
    p.last_name,
    tsp.jersey_number,
    tsp.status,
    tsp.is_active
  ORDER BY
    tsp.jersey_number NULLS LAST,
    p.last_name NULLS LAST,
    p.first_name NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_team_player_parent_links(uuid) IS
  'Eltern-Verknüpfungen je Kader-Spieler (Kader = team_season_players).';

-- ---------------------------------------------------------------------------
-- 4) Player app status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_team_player_app_status(p_team_season_id uuid)
RETURNS TABLE (
  player_id uuid,
  app_status text,
  last_used_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_team_season_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS player_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.player_users pu
        WHERE pu.player_id = p.id
          AND pu.access_mode = 'view_only'
      )
      OR plc.last_used_at IS NOT NULL THEN
        'active'
      WHEN (
        plc.id IS NOT NULL
        AND plc.revoked_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.player_access_invites i
        WHERE i.player_id = p.id
          AND i.revoked_at IS NULL
          AND i.expires_at > now()
          AND i.use_count < i.max_uses
      ) THEN
        'created'
      ELSE
        'not_setup'
    END::text AS app_status,
    plc.last_used_at
  FROM public.team_season_players AS tsp
  INNER JOIN public.players AS p ON p.id = tsp.player_id
  LEFT JOIN LATERAL (
    SELECT c.id, c.last_used_at, c.revoked_at
    FROM public.player_login_credentials AS c
    WHERE c.player_id = p.id
    ORDER BY c.updated_at DESC
    LIMIT 1
  ) AS plc ON true
  WHERE tsp.team_season_id = p_team_season_id
    AND tsp.left_at IS NULL
    AND coalesce(tsp.status, 'active') <> 'archived'
  ORDER BY
    tsp.jersey_number NULLS LAST,
    p.last_name NULLS LAST,
    p.first_name NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_team_player_app_status(uuid) IS
  'Spieler-App Status je Kader-Spieler (Kader = team_season_players).';

-- ---------------------------------------------------------------------------
-- 5) RSVP player policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS event_attendance_insert_player ON public.event_attendance;
CREATE POLICY event_attendance_insert_player ON public.event_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.player_users pu
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND pu.access_mode = 'full'
        AND public.player_in_team_season(pu.player_id, e.team_season_id)
    )
  );

DROP POLICY IF EXISTS event_attendance_update_player ON public.event_attendance;
CREATE POLICY event_attendance_update_player ON public.event_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_users pu
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND pu.access_mode = 'full'
        AND public.player_in_team_season(pu.player_id, e.team_season_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.player_users pu
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND pu.access_mode = 'full'
        AND public.player_in_team_season(pu.player_id, e.team_season_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 6) players Staff-RLS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS players_select_staff_with_paused ON public.players;
CREATE POLICY players_select_staff_with_paused ON public.players
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.staff_can_access_player(players.id)
  );

DROP POLICY IF EXISTS players_insert_staff ON public.players;
CREATE POLICY players_insert_staff ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      players.team_season_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships ms
        WHERE ms.user_id = auth.uid()
          AND ms.team_season_id = players.team_season_id
          AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS players_update_staff ON public.players;
CREATE POLICY players_update_staff ON public.players
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.staff_can_access_player(players.id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.staff_can_access_player(players.id)
    OR (
      players.team_season_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships ms
        WHERE ms.user_id = auth.uid()
          AND ms.team_season_id = players.team_season_id
          AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7) player_profiles coach policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "player_profiles_insert_coach" ON public.player_profiles;
CREATE POLICY "player_profiles_insert_coach"
ON public.player_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.staff_can_access_player(player_profiles.player_id)
);

DROP POLICY IF EXISTS "player_profiles_update_coach" ON public.player_profiles;
CREATE POLICY "player_profiles_update_coach"
ON public.player_profiles
FOR UPDATE
TO authenticated
USING (public.staff_can_access_player(player_profiles.player_id))
WITH CHECK (public.staff_can_access_player(player_profiles.player_id));

-- ---------------------------------------------------------------------------
-- 8) Avatar / Cutout storage (minimal: Join statt players.team_season_id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.player_avatar_storage_may_manage(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_season_id uuid;
  v_folder text;
  v_player_id text;
  v_file text;
BEGIN
  IF length(trim(split_part(p_name, '/', 1))) = 0 THEN
    RETURN false;
  END IF;

  BEGIN
    v_team_season_id := split_part(p_name, '/', 1)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  v_folder := split_part(p_name, '/', 2);

  IF v_folder = 'cutouts' THEN
    v_file := split_part(p_name, '/', 3);
    v_player_id := split_part(v_file, '.', 1);
    IF v_player_id LIKE 'player-%' THEN
      v_player_id := substring(v_player_id from 8);
    END IF;
  ELSE
    v_player_id := split_part(v_folder, '.', 1);
  END IF;

  IF v_player_id IS NULL OR length(trim(v_player_id)) = 0 THEN
    RETURN false;
  END IF;

  RETURN public.can_manage_team_staff(v_team_season_id)
    AND (
      public.player_in_team_season(v_player_id::uuid, v_team_season_id)
      -- Compat: alte Pfade solange players.team_season_id noch gesetzt
      OR EXISTS (
        SELECT 1
        FROM public.players p
        WHERE p.id::text = v_player_id
          AND p.team_season_id = v_team_season_id
      )
    );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN false;
END;
$$;

COMMENT ON FUNCTION public.player_avatar_storage_may_manage(text) IS
  'Storage helper: path {teamSeasonId}/{playerId}.* — Kader via team_season_players (+ compat).';

-- ---------------------------------------------------------------------------
-- 9) Login management: Staff über Join
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_player_login(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_guardian_of_player(p_player_id)
    OR public.staff_can_access_player(p_player_id);
$$;

SELECT pg_notify('pgrst', 'reload schema');
