-- MANAGER-VENUE-GRANTS.UI.2
-- Grant-Kandidaten nur für Anlagen mit mindestens einem aktiven Platz.
-- Auswärtsspielorte (0 Fields) bleiben im Katalog, sind aber nicht freigabefähig.
-- Team-Saison-Sichtbarkeit: serverseitige Lese-Rechte + Club-Team-Saison-Liste.

-- ---------------------------------------------------------------------------
-- 1) Venue hat aktiven Platz?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_has_active_field(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_venue_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.venue_fields vf
      WHERE vf.venue_id = p_venue_id
        AND vf.is_active IS TRUE
    );
$$;

COMMENT ON FUNCTION public.venue_has_active_field(uuid) IS
  'True wenn die Anlage mindestens einen aktiven Platz (venue_fields) besitzt.';

REVOKE ALL ON FUNCTION public.venue_has_active_field(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_has_active_field(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Grant-RPC: neue/aktive Freigaben nur für eingerichtete Anlagen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_team_season_venue_grant(
  p_team_season_id uuid,
  p_venue_id uuid,
  p_purpose text,
  p_is_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purpose text := lower(nullif(btrim(coalesce(p_purpose, '')), ''));
  v_id uuid;
  v_owner uuid;
  v_active boolean := coalesce(p_is_active, true);
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_team_season_id IS NULL OR p_venue_id IS NULL OR v_purpose IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF v_purpose NOT IN ('training', 'home_match') THEN
    RAISE EXCEPTION 'Ungültiger Zweck' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_seasons WHERE id = p_team_season_id) THEN
    RAISE EXCEPTION 'Saison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT v.club_id INTO v_owner FROM public.venues v WHERE v.id = p_venue_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Anlage nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_active AND NOT public.venue_has_active_field(p_venue_id) THEN
    RAISE EXCEPTION
      'Anlage ist nicht eingerichtet (kein aktiver Platz). Zuerst einen Platz anlegen.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.team_season_training_venues (
    team_season_id, venue_id, purpose, is_active, sort_order
  )
  VALUES (
    p_team_season_id, p_venue_id, v_purpose, v_active, coalesce(p_sort_order, 0)
  )
  ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'grant_id', v_id,
    'team_season_id', p_team_season_id,
    'venue_id', p_venue_id,
    'purpose', v_purpose,
    'owner_club_id', v_owner,
    'is_active', v_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_team_season_venue_grant(uuid, uuid, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_team_season_venue_grant(uuid, uuid, text, boolean, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Grant-Kandidaten: nur aktive Anlagen mit aktivem Platz
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_grantable_venues()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'club_id', v.club_id,
          'club_name', c.name,
          'is_active', v.is_active
        )
        ORDER BY c.name, v.name
      )
      FROM public.venues v
      JOIN public.clubs c ON c.id = v.club_id
      WHERE coalesce(v.is_active, true)
        AND public.venue_has_active_field(v.id)
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_grantable_venues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_grantable_venues() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Team-Saison-Sichtbarkeit (minimal, serverseitig)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_club_admin_for_club(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_club_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      JOIN public.team_seasons ts ON ts.id = m.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = p_club_id
        AND m.user_id = auth.uid()
        AND lower(m.role::text) = 'admin'
    );
$$;

COMMENT ON FUNCTION public.is_club_admin_for_club(uuid) IS
  'True wenn auth.uid() Vereinsadmin (memberships.role=admin) für mindestens eine Saison des Clubs ist.';

REVOKE ALL ON FUNCTION public.is_club_admin_for_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_admin_for_club(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_team_season(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_team_season_id IS NOT NULL
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.team_season_id = p_team_season_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.team_seasons ts
        JOIN public.teams t ON t.id = ts.team_id
        WHERE ts.id = p_team_season_id
          AND public.is_club_admin_for_club(t.club_id)
      )
    );
$$;

COMMENT ON FUNCTION public.can_read_team_season(uuid) IS
  'Plattformadmin, Mitglied der Saison oder Vereinsadmin des Clubs.';

REVOKE ALL ON FUNCTION public.can_read_team_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_team_season(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_club_team_season_ids(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_club_id IS NULL OR auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF public.is_admin() OR public.is_club_admin_for_club(p_club_id) THEN
    RETURN coalesce(
      (
        SELECT jsonb_agg(ts.id ORDER BY t.name, ts.id)
        FROM public.team_seasons ts
        JOIN public.teams t ON t.id = ts.team_id
        WHERE t.club_id = p_club_id
          AND ts.status IN ('active', 'draft')
      ),
      '[]'::jsonb
    );
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(DISTINCT m.team_season_id ORDER BY m.team_season_id)
      FROM public.memberships m
      JOIN public.team_seasons ts ON ts.id = m.team_season_id
      JOIN public.teams t ON t.id = ts.team_id
      WHERE t.club_id = p_club_id
        AND m.user_id = auth.uid()
        AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'head', 'admin')
        AND ts.status IN ('active', 'draft')
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.list_club_team_season_ids(uuid) IS
  'Sichtbare Team-Saisons eines Clubs: Plattformadmin/Vereinsadmin → alle; Trainer → nur eigene Staff-Saisons.';

REVOKE ALL ON FUNCTION public.list_club_team_season_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_club_team_season_ids(uuid) TO authenticated;

ALTER TABLE public.team_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_seasons_select ON public.team_seasons;
CREATE POLICY team_seasons_select
  ON public.team_seasons
  FOR SELECT
  TO authenticated
  USING (public.can_read_team_season(id));

COMMENT ON POLICY team_seasons_select ON public.team_seasons IS
  'Lesen nur für Plattformadmin, Saison-Mitglied oder Vereinsadmin des Clubs.';

SELECT pg_notify('pgrst', 'reload schema');
