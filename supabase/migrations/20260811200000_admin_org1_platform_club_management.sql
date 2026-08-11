-- ADMIN-ORG.1: Platform-/Hauptadmin-Vereinsverwaltung (Staging)
-- Erweitert das bestehende is_admin()-Modell; keine parallele MANAGER-RECHTE.1-Architektur.
-- Hard Delete nur für wirklich leere Vereine; Archivieren ist Standard.

-- ---------------------------------------------------------------------------
-- 1) Clubs: Stammdaten + Archivstatus (additiv)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clubs_status_check'
      AND conrelid = 'public.clubs'::regclass
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_status_check
      CHECK (status IN ('active', 'archived'));
  END IF;
END $$;

UPDATE public.clubs
SET status = 'active'
WHERE status IS NULL OR btrim(status) = '';

COMMENT ON COLUMN public.clubs.status IS
  'active | archived. Archivierte Vereine bleiben historisch lesbar, sind aber nicht operativ nutzbar.';

-- ---------------------------------------------------------------------------
-- 2) Helper: Plattformadmin = bestehendes is_admin()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'Alias für public.is_admin() – Plattform-/Hauptadmin (user_roles.admin oder profiles.is_admin).';

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.club_is_operable(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = p_club_id
      AND c.status = 'active'
  );
$$;

COMMENT ON FUNCTION public.club_is_operable(uuid) IS
  'True wenn der Verein existiert und status=active (operative Nutzung erlaubt).';

REVOKE ALL ON FUNCTION public.club_is_operable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_is_operable(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_club_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

DROP INDEX IF EXISTS public.clubs_name_normalized_uidx;
CREATE UNIQUE INDEX clubs_name_normalized_uidx
  ON public.clubs (public.normalize_club_name(name));

CREATE INDEX IF NOT EXISTS clubs_status_idx ON public.clubs (status);

-- ---------------------------------------------------------------------------
-- 3) Self-Elevation-Schutz (profiles.is_admin + user_roles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_protect_profiles_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    -- Nur Service-Role / Superuser / vertrauenswürdige Admin-RPC.
    IF coalesce(auth.role(), '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF current_user IN ('postgres', 'supabase_admin') THEN
      RETURN NEW;
    END IF;
    IF coalesce(current_setting('spielzeit.allow_user_roles_mutation', true), '') = '1' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'profiles.is_admin darf nicht clientseitig geändert werden'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_is_admin ON public.profiles;
CREATE TRIGGER trg_protect_profiles_is_admin
  BEFORE UPDATE OF is_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_protect_profiles_is_admin();

CREATE OR REPLACE FUNCTION public.tg_protect_user_roles_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- Vertrauenswürdige Admin-RPC setzt local config
  IF coalesce(current_setting('spielzeit.allow_user_roles_mutation', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'user_roles darf nicht clientseitig verändert werden'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_roles_mutations ON public.user_roles;
CREATE TRIGGER trg_protect_user_roles_mutations
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_protect_user_roles_mutations();

-- ---------------------------------------------------------------------------
-- 4) Operative Sperre für archivierte Vereine (Teams)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_clubs_block_ops_when_archived()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  v_club_id := NEW.club_id;
  IF v_club_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.club_is_operable(v_club_id) THEN
    RAISE EXCEPTION 'Archivierter Verein: neue operative Daten sind nicht erlaubt'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_require_operable_club ON public.teams;
CREATE TRIGGER trg_teams_require_operable_club
  BEFORE INSERT OR UPDATE OF club_id ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_clubs_block_ops_when_archived();

-- can_manage_club_venues: archivierte Vereine nicht operativ bearbeiten
CREATE OR REPLACE FUNCTION public.can_manage_club_venues(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      public.is_admin()
      OR (
        p_club_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.memberships AS m
          JOIN public.team_seasons AS ts ON ts.id = m.team_season_id
          JOIN public.teams AS t ON t.id = ts.team_id
          WHERE t.club_id = p_club_id
            AND m.user_id = auth.uid()
            AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
        )
      )
    )
    AND public.club_is_operable(p_club_id);
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS clubs: kein freier Insert/Update/Delete; Lesen für Auth
-- ---------------------------------------------------------------------------
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clubs_select_authenticated ON public.clubs;
CREATE POLICY clubs_select_authenticated
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR status = 'active'
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      JOIN public.team_seasons ts ON ts.id = m.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = clubs.id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS clubs_insert_platform_admin ON public.clubs;
CREATE POLICY clubs_insert_platform_admin
  ON public.clubs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS clubs_update_platform_admin ON public.clubs;
CREATE POLICY clubs_update_platform_admin
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS clubs_delete_platform_admin ON public.clubs;
CREATE POLICY clubs_delete_platform_admin
  ON public.clubs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Anon: keine Schreibrechte über Policies (Default deny bei FORCE RLS)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.clubs FROM anon;
GRANT SELECT ON public.clubs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clubs TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Abhängigkeitsprüfung
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_club_dependency_counts(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teams int;
  v_team_seasons int;
  v_memberships int;
  v_venues int;
  v_team_venues int;
  v_opponent int;
  v_fields int;
  v_zones int;
  v_assignments int;
  v_training_ex int;
  v_training_sess int;
  v_events int;
  v_staff int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_teams FROM public.teams WHERE club_id = p_club_id;
  SELECT count(*) INTO v_team_seasons
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE t.club_id = p_club_id;
  SELECT count(*) INTO v_memberships
  FROM public.memberships m
  JOIN public.team_seasons ts ON ts.id = m.team_season_id
  JOIN public.teams t ON t.id = ts.team_id
  WHERE t.club_id = p_club_id;
  SELECT count(*) INTO v_venues FROM public.venues WHERE club_id = p_club_id;
  SELECT count(*) INTO v_team_venues FROM public.team_venues WHERE club_id = p_club_id;
  SELECT count(*) INTO v_opponent FROM public.opponent_catalog WHERE club_id = p_club_id;
  SELECT count(*) INTO v_fields FROM public.venue_fields WHERE club_id = p_club_id;
  SELECT count(*) INTO v_zones FROM public.venue_field_zones WHERE club_id = p_club_id;
  SELECT count(*) INTO v_assignments FROM public.event_field_assignments WHERE club_id = p_club_id;
  SELECT count(*) INTO v_training_ex FROM public.training_exercises WHERE club_id = p_club_id;
  SELECT count(*) INTO v_training_sess FROM public.training_sessions WHERE club_id = p_club_id;
  SELECT count(*) INTO v_events
  FROM public.events e
  JOIN public.team_seasons ts ON ts.id = e.team_season_id
  JOIN public.teams t ON t.id = ts.team_id
  WHERE t.club_id = p_club_id;
  SELECT count(DISTINCT m.user_id) INTO v_staff
  FROM public.memberships m
  JOIN public.team_seasons ts ON ts.id = m.team_season_id
  JOIN public.teams t ON t.id = ts.team_id
  WHERE t.club_id = p_club_id
    AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'head', 'admin');

  RETURN jsonb_build_object(
    'teams', v_teams,
    'team_seasons', v_team_seasons,
    'memberships', v_memberships,
    'staff_users', v_staff,
    'venues', v_venues,
    'team_venues', v_team_venues,
    'opponent_catalog', v_opponent,
    'venue_fields', v_fields,
    'venue_field_zones', v_zones,
    'event_field_assignments', v_assignments,
    'training_exercises', v_training_ex,
    'training_sessions', v_training_sess,
    'events', v_events,
    'total_blocking', (
      v_teams + v_team_seasons + v_memberships + v_venues + v_team_venues +
      v_opponent + v_fields + v_zones + v_assignments + v_training_ex +
      v_training_sess + v_events
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_club_dependency_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_club_dependency_counts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_club_is_empty(p_club_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb;
BEGIN
  d := public.admin_club_dependency_counts(p_club_id);
  RETURN coalesce((d ->> 'total_blocking')::int, 1) = 0;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_club_is_empty(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_club_is_empty(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) List / Get / CRUD RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_clubs(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  short_name text,
  status text,
  created_at timestamptz,
  archived_at timestamptz,
  team_count bigint,
  active_season_count bigint,
  staff_admin_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('active', 'archived', 'all') THEN
    RAISE EXCEPTION 'Ungültiger Statusfilter' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.short_name,
    c.status,
    c.created_at,
    c.archived_at,
    (SELECT count(*) FROM public.teams t WHERE t.club_id = c.id) AS team_count,
    (
      SELECT count(*)
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = c.id
        AND lower(coalesce(ts.status::text, '')) = 'active'
    ) AS active_season_count,
    (
      SELECT count(DISTINCT m.user_id)
      FROM public.memberships m
      JOIN public.team_seasons ts ON ts.id = m.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = c.id
        AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'head', 'admin')
    ) AS staff_admin_count
  FROM public.clubs c
  WHERE (
      v_status IS NULL
      OR v_status = 'all'
      OR c.status = v_status
    )
    AND (
      v_search IS NULL
      OR public.normalize_club_name(c.name) LIKE '%' || public.normalize_club_name(v_search) || '%'
      OR public.normalize_club_name(coalesce(c.short_name, '')) LIKE '%' || public.normalize_club_name(v_search) || '%'
    )
  ORDER BY c.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_clubs(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_clubs(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_club(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.clubs%ROWTYPE;
  v_deps jsonb;
  v_teams jsonb;
  v_seasons jsonb;
  v_staff jsonb;
  v_venues jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.clubs WHERE id = p_club_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  v_deps := public.admin_club_dependency_counts(p_club_id);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name
  ) ORDER BY t.name), '[]'::jsonb)
  INTO v_teams
  FROM public.teams t
  WHERE t.club_id = p_club_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ts.id,
    'team_id', ts.team_id,
    'team_name', t.name,
    'status', ts.status,
    'season_name', s.name,
    'age_group', ts.age_group
  ) ORDER BY t.name, s.name), '[]'::jsonb)
  INTO v_seasons
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  LEFT JOIN public.seasons s ON s.id = ts.season_id
  WHERE t.club_id = p_club_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', x.user_id,
    'first_name', x.first_name,
    'last_name', x.last_name,
    'roles', x.roles
  ) ORDER BY x.last_name, x.first_name), '[]'::jsonb)
  INTO v_staff
  FROM (
    SELECT
      m.user_id,
      p.first_name,
      p.last_name,
      array_agg(DISTINCT m.role::text ORDER BY m.role::text) AS roles
    FROM public.memberships m
    JOIN public.team_seasons ts ON ts.id = m.team_season_id
    JOIN public.teams t ON t.id = ts.team_id
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE t.club_id = p_club_id
      AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'head', 'admin')
    GROUP BY m.user_id, p.first_name, p.last_name
  ) x;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'name', v.name
  ) ORDER BY v.name), '[]'::jsonb)
  INTO v_venues
  FROM public.venues v
  WHERE v.club_id = p_club_id;

  RETURN jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'short_name', c.short_name,
    'status', c.status,
    'created_at', c.created_at,
    'archived_at', c.archived_at,
    'archived_by', c.archived_by,
    'updated_at', c.updated_at,
    'can_hard_delete', public.admin_club_is_empty(p_club_id),
    'dependencies', v_deps,
    'teams', v_teams,
    'team_seasons', v_seasons,
    'staff', v_staff,
    'venues', v_venues
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_club(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_club(
  p_name text,
  p_short_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_short text := nullif(btrim(coalesce(p_short_name, '')), '');
  v_id uuid;
  v_existing uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Vereinsname ist Pflicht' USING ERRCODE = '22023';
  END IF;

  SELECT c.id INTO v_existing
  FROM public.clubs c
  WHERE public.normalize_club_name(c.name) = public.normalize_club_name(v_name)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Verein mit diesem Namen existiert bereits (aktiv oder archiviert)'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.clubs (name, short_name, status, created_at, updated_at)
  VALUES (v_name, v_short, 'active', now(), now())
  RETURNING id INTO v_id;

  RETURN public.admin_get_club(v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_club(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_club(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_club(
  p_club_id uuid,
  p_name text,
  p_short_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_short text := nullif(btrim(coalesce(p_short_name, '')), '');
  v_existing uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Vereinsname ist Pflicht' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.id INTO v_existing
  FROM public.clubs c
  WHERE public.normalize_club_name(c.name) = public.normalize_club_name(v_name)
    AND c.id <> p_club_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Verein mit diesem Namen existiert bereits (aktiv oder archiviert)'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.clubs
  SET
    name = v_name,
    short_name = v_short,
    updated_at = now()
  WHERE id = p_club_id;

  RETURN public.admin_get_club(p_club_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_club(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_club(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_archive_club(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.clubs
  SET
    status = 'archived',
    archived_at = now(),
    archived_by = auth.uid(),
    updated_at = now()
  WHERE id = p_club_id;

  RETURN public.admin_get_club(p_club_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_archive_club(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_restore_club(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.clubs
  SET
    status = 'active',
    archived_at = NULL,
    archived_by = NULL,
    updated_at = now()
  WHERE id = p_club_id;

  RETURN public.admin_get_club(p_club_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restore_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_club(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_empty_club(
  p_club_id uuid,
  p_confirm_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club public.clubs%ROWTYPE;
  v_deps jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_club
  FROM public.clubs
  WHERE id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF btrim(coalesce(p_confirm_name, '')) <> v_club.name THEN
    RAISE EXCEPTION 'Bestätigungsname stimmt nicht überein' USING ERRCODE = '22023';
  END IF;

  v_deps := public.admin_club_dependency_counts(p_club_id);
  IF coalesce((v_deps ->> 'total_blocking')::int, 1) <> 0 THEN
    RAISE EXCEPTION 'Verein hat abhängige Daten und kann nicht endgültig gelöscht werden. Bitte archivieren.'
      USING ERRCODE = 'P0001',
            DETAIL = v_deps::text;
  END IF;

  -- Kein CASCADE großer Bestände: nur leere Zeile löschen.
  DELETE FROM public.clubs WHERE id = p_club_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'id', p_club_id,
    'name', v_club.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_empty_club(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_empty_club(uuid, text) TO authenticated;

-- Vertrauenswürdige Plattformrollen-Vergabe (nur bestehender Plattformadmin)
CREATE OR REPLACE FUNCTION public.admin_set_platform_admin(
  p_user_id uuid,
  p_is_admin boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id fehlt' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Benutzer nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  -- Self-demote verhindern, wenn man der letzte Admin wäre, ist ok; Self-elevate über RPC
  -- ist erlaubt nur für bereits is_admin()-Caller.

  PERFORM set_config('spielzeit.allow_user_roles_mutation', '1', true);

  IF p_is_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET is_admin = true WHERE id = p_user_id;
  ELSE
    IF p_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Eigene Plattformadmin-Rolle kann nicht entfernt werden'
        USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND lower(trim(role)) = 'admin';
    UPDATE public.profiles SET is_admin = false WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_platform_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_admin(uuid, boolean) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
