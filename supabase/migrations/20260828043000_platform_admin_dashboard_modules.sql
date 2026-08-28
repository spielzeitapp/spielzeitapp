-- PLATFORM-ADMIN.2 (Staging/develop)
-- Plattform-Dashboard, Vereinsmodule und protokollierter Supportzugriff.

CREATE TABLE IF NOT EXISTS public.platform_modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  availability text NOT NULL DEFAULT 'ready',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_modules_category_check
    CHECK (category IN ('core', 'sport', 'content', 'administration')),
  CONSTRAINT platform_modules_availability_check
    CHECK (availability IN ('ready', 'planned', 'beta'))
);

CREATE TABLE IF NOT EXISTS public.club_modules (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.platform_modules(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.platform_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  club_id uuid NULL REFERENCES public.clubs(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  old_data jsonb NULL,
  new_data jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_modules_club_enabled
  ON public.club_modules (club_id, enabled);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_club_created
  ON public.platform_admin_audit_log (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_admin_created
  ON public.platform_admin_audit_log (admin_user_id, created_at DESC);

COMMENT ON TABLE public.platform_modules IS
  'Zentraler Modulkatalog. Grundmodule (is_core=true) sind für jeden Verein immer aktiv.';
COMMENT ON TABLE public.club_modules IS
  'Explizite Freischaltungen von Zusatzmodulen je Verein.';
COMMENT ON TABLE public.platform_admin_audit_log IS
  'Unveränderliches Protokoll sicherheitsrelevanter Plattformadmin-Aktionen.';

INSERT INTO public.platform_modules
  (key, name, description, category, is_core, availability, sort_order)
VALUES
  ('dashboard', 'Dashboard', 'Vereins- und Mannschaftsübersicht', 'core', true, 'ready', 10),
  ('squad', 'Mannschaften', 'Mannschaften und Zuordnungen', 'core', true, 'ready', 20),
  ('players', 'Spieler & Kader', 'Spieler, Kader und Status', 'core', true, 'ready', 30),
  ('parents', 'Eltern & Benutzer', 'Elternzugänge und Verknüpfungen', 'core', true, 'planned', 40),
  ('events', 'Termine & Kalender', 'Termine sowie Zu- und Absagen', 'core', true, 'planned', 50),
  ('seasons', 'Saisonen', 'Saisonverwaltung und Saisonwechsel', 'core', true, 'ready', 60),
  ('notifications', 'Benachrichtigungen', 'Push-Nachrichten und Hinweise', 'core', true, 'ready', 70),
  ('permissions', 'Rollen & Berechtigungen', 'Vereinsrollen und Zugriffe', 'core', true, 'planned', 80),
  ('training', 'Trainingsplanung', 'Trainingseinheiten planen und dokumentieren', 'sport', false, 'ready', 110),
  ('training-lib', 'Übungsbibliothek', 'Vereinsweite Übungssammlung', 'sport', false, 'ready', 120),
  ('training-tpl', 'Trainingsvorlagen', 'Wiederverwendbare Trainingspläne', 'sport', false, 'ready', 130),
  ('training-chronik', 'Trainingschronik', 'Historie durchgeführter Einheiten', 'sport', false, 'ready', 140),
  ('matches', 'Spiele & Live', 'Spielplanung, Aufstellung und Live-Spiel', 'sport', false, 'planned', 150),
  ('tournaments', 'Turniercenter', 'Turnierplanung und Live-Begleitung', 'sport', false, 'planned', 160),
  ('venues', 'Platzbelegung', 'Sportanlagen und Platzbelegung', 'sport', false, 'ready', 170),
  ('video', 'Video & Analyse', 'Videoverwaltung und Spielanalyse', 'sport', false, 'planned', 180),
  ('chronicle', 'Team-Chronik', 'Chronik und Vereinsgeschichte', 'content', false, 'planned', 210),
  ('social', 'Social Media', 'Feed, Spieltagsgrafiken und Autoposts', 'content', false, 'planned', 220),
  ('equipment', 'Ausrüstung & Teamshop', 'Ausrüstung, Bestände und Teamshop', 'administration', false, 'planned', 310)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_core = EXCLUDED.is_core,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Bestandswahrung: Bereits verfügbare fertige Manager-Module bleiben für vorhandene Vereine aktiv.
INSERT INTO public.club_modules (club_id, module_key, enabled)
SELECT c.id, m.key, true
FROM public.clubs c
CROSS JOIN public.platform_modules m
WHERE m.key IN ('training', 'training-lib', 'training-tpl', 'training-chronik', 'venues')
ON CONFLICT (club_id, module_key) DO NOTHING;

ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_modules_read_authenticated ON public.platform_modules;
CREATE POLICY platform_modules_read_authenticated ON public.platform_modules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS club_modules_read_authorized ON public.club_modules;
CREATE POLICY club_modules_read_authorized ON public.club_modules
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships ms
      JOIN public.team_seasons ts ON ts.id = ms.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ms.user_id = auth.uid()
        AND t.club_id = club_modules.club_id
    )
  );

DROP POLICY IF EXISTS platform_admin_audit_read_admin ON public.platform_admin_audit_log;
CREATE POLICY platform_admin_audit_read_admin ON public.platform_admin_audit_log
  FOR SELECT TO authenticated USING (public.is_platform_admin());

-- Writes erfolgen ausschließlich über SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.club_effective_modules(p_club_id uuid)
RETURNS TABLE (
  module_key text,
  name text,
  description text,
  category text,
  is_core boolean,
  availability text,
  enabled boolean,
  sort_order integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1
    FROM public.memberships ms
    JOIN public.team_seasons ts ON ts.id = ms.team_season_id
    JOIN public.teams t ON t.id = ts.team_id
    WHERE ms.user_id = auth.uid() AND t.club_id = p_club_id
  ) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Verein' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.key,
    m.name,
    m.description,
    m.category,
    m.is_core,
    m.availability,
    CASE WHEN m.is_core THEN true ELSE coalesce(cm.enabled, false) END,
    m.sort_order
  FROM public.platform_modules m
  LEFT JOIN public.club_modules cm
    ON cm.club_id = p_club_id AND cm.module_key = m.key
  ORDER BY m.sort_order, m.name;
END;
$$;

REVOKE ALL ON FUNCTION public.club_effective_modules(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_effective_modules(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_platform_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'active_clubs', count(*) FILTER (WHERE c.status = 'active'),
    'archived_clubs', count(*) FILTER (WHERE c.status = 'archived'),
    'teams', (SELECT count(*) FROM public.teams),
    'active_seasons', (
      SELECT count(*) FROM public.team_seasons ts
      WHERE lower(coalesce(ts.status::text, '')) = 'active'
    ),
    'users', (SELECT count(DISTINCT ms.user_id) FROM public.memberships ms),
    'active_players', (
      SELECT count(DISTINCT tsp.player_id)
      FROM public.team_season_players tsp
      WHERE tsp.is_active = true AND tsp.status = 'active'
    ),
    'clubs_without_active_season', (
      SELECT count(*)
      FROM public.clubs cx
      WHERE cx.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.teams t
          JOIN public.team_seasons ts ON ts.team_id = t.id
          WHERE t.club_id = cx.id AND lower(coalesce(ts.status::text, '')) = 'active'
        )
    )
  ) INTO v_result
  FROM public.clubs c;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_platform_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_dashboard() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_clubs_v2(
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
  staff_admin_count bigint,
  user_count bigint,
  active_player_count bigint,
  enabled_module_count bigint,
  available_module_count bigint,
  last_activity_at timestamptz
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
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.short_name,
    c.status,
    c.created_at,
    c.archived_at,
    (SELECT count(*) FROM public.teams t WHERE t.club_id = c.id),
    (
      SELECT count(*) FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = c.id AND lower(coalesce(ts.status::text, '')) = 'active'
    ),
    (
      SELECT count(DISTINCT ms.user_id) FROM public.memberships ms
      JOIN public.team_seasons ts ON ts.id = ms.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = c.id
        AND lower(ms.role::text) IN ('trainer','co_trainer','head_coach','head','admin')
    ),
    (
      SELECT count(DISTINCT ms.user_id) FROM public.memberships ms
      JOIN public.team_seasons ts ON ts.id = ms.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = c.id
    ),
    (
      SELECT count(DISTINCT tsp.player_id) FROM public.team_season_players tsp
      JOIN public.team_seasons ts ON ts.id = tsp.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = c.id AND tsp.is_active = true AND tsp.status = 'active'
    ),
    (
      SELECT count(*) FROM public.platform_modules m
      WHERE m.is_core OR EXISTS (
        SELECT 1 FROM public.club_modules cm
        WHERE cm.club_id = c.id AND cm.module_key = m.key AND cm.enabled
      )
    ),
    (SELECT count(*) FROM public.platform_modules),
    (
      SELECT max(e.created_at) FROM public.events e
      JOIN public.team_seasons ts ON ts.id = e.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = c.id
    )
  FROM public.clubs c
  WHERE (v_status IS NULL OR v_status = 'all' OR c.status = v_status)
    AND (
      v_search IS NULL
      OR public.normalize_club_name(c.name) LIKE '%' || public.normalize_club_name(v_search) || '%'
      OR public.normalize_club_name(coalesce(c.short_name, '')) LIKE '%' || public.normalize_club_name(v_search) || '%'
    )
  ORDER BY c.name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_clubs_v2(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_clubs_v2(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_club_module(
  p_club_id uuid,
  p_module_key text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module public.platform_modules%ROWTYPE;
  v_old boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_module FROM public.platform_modules WHERE key = p_module_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modul nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF v_module.is_core THEN
    RAISE EXCEPTION 'Grundmodule sind immer aktiv' USING ERRCODE = '22023';
  END IF;

  SELECT enabled INTO v_old
  FROM public.club_modules
  WHERE club_id = p_club_id AND module_key = p_module_key;

  INSERT INTO public.club_modules (club_id, module_key, enabled, updated_by)
  VALUES (p_club_id, p_module_key, p_enabled, auth.uid())
  ON CONFLICT (club_id, module_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_by = auth.uid(),
    updated_at = now();

  INSERT INTO public.platform_admin_audit_log
    (admin_user_id, club_id, action, entity_type, entity_id, old_data, new_data)
  VALUES
    (auth.uid(), p_club_id, 'module_changed', 'club_module', p_module_key,
     jsonb_build_object('enabled', coalesce(v_old, false)),
     jsonb_build_object('enabled', p_enabled));

  RETURN jsonb_build_object('club_id', p_club_id, 'module_key', p_module_key, 'enabled', p_enabled);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_club_module(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_club_module(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_log_support_access(
  p_club_id uuid,
  p_action text,
  p_team_season_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := lower(btrim(coalesce(p_action, '')));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('support_started', 'support_ended') THEN
    RAISE EXCEPTION 'Ungültige Supportaktion' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.platform_admin_audit_log
    (admin_user_id, club_id, action, entity_type, entity_id, new_data)
  VALUES
    (auth.uid(), p_club_id, v_action, 'club_support', p_club_id::text,
     jsonb_build_object('team_season_id', p_team_season_id));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_support_access(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_log_support_access(uuid, text, uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
