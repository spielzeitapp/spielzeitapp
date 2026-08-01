-- STEP 3: saisonfähige Kaderzuordnung (additiv).
-- players bleibt Stammdatensatz; team_season_players = Kader pro Saison.
-- players.team_season_id bleibt bestehen (Compatibility / Dual-Read).
-- Keine App-Umschaltung in dieser Migration. Kein Drop. Keine Stats-Kopie.
--
-- WICHTIG: Nur auf Staging anwenden (acbaecjzoabafbsjrzvr), nicht Live/main.

-- ---------------------------------------------------------------------------
-- 1) Tabelle
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_season_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  jersey_number integer NULL,
  position text NULL,
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  is_laz_player boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_season_players_status_check
    CHECK (status IN ('active', 'paused', 'archived')),
  CONSTRAINT team_season_players_player_season_unique
    UNIQUE (player_id, team_season_id)
);

COMMENT ON TABLE public.team_season_players IS
  'Saisonbezogene Kaderzuordnung. Stamm bleibt in public.players (stabile player_id).';

COMMENT ON COLUMN public.team_season_players.jersey_number IS
  'Rückennummer in dieser Saison. Kein UNIQUE-Constraint (Bestandsdaten können Duplikate haben).';

COMMENT ON COLUMN public.team_season_players.is_laz_player IS
  'LAZ-Markierung für diese Saison (Startwert beim Wechsel kopierbar).';

CREATE INDEX IF NOT EXISTS idx_team_season_players_team_season
  ON public.team_season_players (team_season_id);

CREATE INDEX IF NOT EXISTS idx_team_season_players_player
  ON public.team_season_players (player_id);

CREATE INDEX IF NOT EXISTS idx_team_season_players_team_season_status
  ON public.team_season_players (team_season_id, status);

CREATE INDEX IF NOT EXISTS idx_team_season_players_team_jersey
  ON public.team_season_players (team_season_id, jersey_number)
  WHERE jersey_number IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) updated_at Trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_team_season_players_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_season_players_updated_at ON public.team_season_players;
CREATE TRIGGER trg_team_season_players_updated_at
  BEFORE UPDATE ON public.team_season_players
  FOR EACH ROW
  EXECUTE FUNCTION public.set_team_season_players_updated_at();

-- ---------------------------------------------------------------------------
-- 3) Soft-Lock Helper: archived Saison nicht beschreibbar
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.team_season_is_writable(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_seasons ts
    WHERE ts.id = p_team_season_id
      AND lower(coalesce(ts.status, 'active')) <> 'archived'
      AND ts.archived_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.team_season_is_writable(uuid) IS
  'False wenn team_season status=archived (oder archived_at gesetzt). Für Soft-Lock auf Kader-Writes.';

REVOKE ALL ON FUNCTION public.team_season_is_writable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_season_is_writable(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Backfill aus players.team_season_id (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.team_season_players (
  player_id,
  team_season_id,
  jersey_number,
  position,
  status,
  is_active,
  is_laz_player,
  joined_at,
  left_at,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.team_season_id,
  p.jersey_number,
  NULLIF(trim(p.position), ''),
  CASE
    WHEN lower(coalesce(p.status, 'active')) IN ('active', 'paused', 'archived')
      THEN lower(coalesce(p.status, 'active'))
    ELSE 'active'
  END,
  coalesce(p.is_active, true),
  coalesce(p.is_laz_player, false),
  now(),
  NULL,
  now(),
  now()
FROM public.players p
WHERE p.team_season_id IS NOT NULL
ON CONFLICT (player_id, team_season_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) Read-only View (optional Helper; App nutzt sie in STEP 3 noch nicht zwingend)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_team_season_roster
WITH (security_invoker = true)
AS
SELECT
  tsp.id AS roster_id,
  tsp.team_season_id,
  tsp.player_id,
  tsp.jersey_number,
  tsp.position AS season_position,
  tsp.status AS season_status,
  tsp.is_active AS season_is_active,
  tsp.is_laz_player AS season_is_laz_player,
  tsp.joined_at,
  tsp.left_at,
  p.first_name,
  p.last_name,
  p.cutout_url,
  p.is_injured,
  p.injured_since,
  p.injured_until,
  -- Compatibility: aktuelle Spalte am Stamm (noch nicht entfernt)
  p.team_season_id AS players_team_season_id
FROM public.team_season_players tsp
INNER JOIN public.players p ON p.id = tsp.player_id;

COMMENT ON VIEW public.v_team_season_roster IS
  'Read-only Kader-View: Join team_season_players + players. Security invoker = RLS der Basistabellen.';

GRANT SELECT ON public.v_team_season_roster TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.team_season_players ENABLE ROW LEVEL SECURITY;

-- Lesen: Membership der Season ODER Guardian/User des Spielers ODER Admin
DROP POLICY IF EXISTS team_season_players_select ON public.team_season_players;
CREATE POLICY team_season_players_select ON public.team_season_players
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships ms
      WHERE ms.team_season_id = team_season_players.team_season_id
        AND ms.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.player_guardians pg
      WHERE pg.player_id = team_season_players.player_id
        AND pg.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.player_users pu
      WHERE pu.player_id = team_season_players.player_id
        AND pu.user_id = auth.uid()
    )
  );

-- Insert: Staff der Season + Season writable (nicht archived)
DROP POLICY IF EXISTS team_season_players_insert ON public.team_season_players;
CREATE POLICY team_season_players_insert ON public.team_season_players
  FOR INSERT TO authenticated
  WITH CHECK (
    public.team_season_is_writable(team_season_players.team_season_id)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships ms
        WHERE ms.team_season_id = team_season_players.team_season_id
          AND ms.user_id = auth.uid()
          AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    )
  );

-- Update: Staff + writable
DROP POLICY IF EXISTS team_season_players_update ON public.team_season_players;
CREATE POLICY team_season_players_update ON public.team_season_players
  FOR UPDATE TO authenticated
  USING (
    public.team_season_is_writable(team_season_players.team_season_id)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships ms
        WHERE ms.team_season_id = team_season_players.team_season_id
          AND ms.user_id = auth.uid()
          AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    )
  )
  WITH CHECK (
    public.team_season_is_writable(team_season_players.team_season_id)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships ms
        WHERE ms.team_season_id = team_season_players.team_season_id
          AND ms.user_id = auth.uid()
          AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    )
  );

-- Delete: Staff + writable (Kaderzeile entfernen, nicht Player löschen)
DROP POLICY IF EXISTS team_season_players_delete ON public.team_season_players;
CREATE POLICY team_season_players_delete ON public.team_season_players
  FOR DELETE TO authenticated
  USING (
    public.team_season_is_writable(team_season_players.team_season_id)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships ms
        WHERE ms.team_season_id = team_season_players.team_season_id
          AND ms.user_id = auth.uid()
          AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
