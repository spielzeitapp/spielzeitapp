-- Spielerzugänge folgen der aktuell aktiven Saison des stabilen Spielers.
-- Bisher speicherten Code/PIN und QR-Einladungen den Legacy-Wert
-- players.team_season_id. Nach einem Saisonwechsel konnte dieser noch auf die
-- archivierte Vorsaison zeigen, obwohl der Spieler bereits im aktuellen Kader
-- (team_season_players) stand.

CREATE OR REPLACE FUNCTION public.resolve_player_access_team_season(
  p_player_id uuid,
  p_fallback_team_season_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT tsp.team_season_id
      FROM public.team_season_players tsp
      JOIN public.team_seasons ts ON ts.id = tsp.team_season_id
      WHERE tsp.player_id = p_player_id
        AND tsp.is_active = true
        AND tsp.left_at IS NULL
        AND lower(coalesce(tsp.status, 'active')) <> 'archived'
        AND lower(coalesce(ts.status, 'active')) = 'active'
        AND ts.archived_at IS NULL
      ORDER BY
        CASE WHEN lower(coalesce(tsp.status, 'active')) = 'active' THEN 0 ELSE 1 END,
        tsp.updated_at DESC,
        tsp.team_season_id
      LIMIT 1
    ),
    p_fallback_team_season_id
  );
$$;

COMMENT ON FUNCTION public.resolve_player_access_team_season(uuid, uuid) IS
  'Aktive Kadersaison eines stabilen Spielers; Legacy-Saison nur als Fallback.';

REVOKE ALL ON FUNCTION public.resolve_player_access_team_season(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.set_player_access_active_season()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.team_season_id := public.resolve_player_access_team_season(
    NEW.player_id,
    NEW.team_season_id
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_player_access_active_season() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_player_login_credentials_active_season
  ON public.player_login_credentials;
CREATE TRIGGER trg_player_login_credentials_active_season
  BEFORE INSERT OR UPDATE OF player_id, team_season_id
  ON public.player_login_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_player_access_active_season();

DROP TRIGGER IF EXISTS trg_player_access_invites_active_season
  ON public.player_access_invites;
CREATE TRIGGER trg_player_access_invites_active_season
  BEFORE INSERT OR UPDATE OF player_id, team_season_id
  ON public.player_access_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_player_access_active_season();

-- Bestehende dauerhafte Code/PIN-Zugänge auf die aktive Saison umhängen.
UPDATE public.player_login_credentials credentials
SET
  team_season_id = public.resolve_player_access_team_season(
    credentials.player_id,
    credentials.team_season_id
  ),
  updated_at = now()
WHERE public.resolve_player_access_team_season(
    credentials.player_id,
    credentials.team_season_id
  ) IS DISTINCT FROM credentials.team_season_id;

-- Noch nicht verwendete QR-Einladungen ebenfalls auf die aktive Saison setzen.
UPDATE public.player_access_invites invites
SET team_season_id = public.resolve_player_access_team_season(
    invites.player_id,
    invites.team_season_id
  )
WHERE invites.revoked_at IS NULL
  AND invites.use_count < invites.max_uses
  AND public.resolve_player_access_team_season(
    invites.player_id,
    invites.team_season_id
  ) IS DISTINCT FROM invites.team_season_id;

-- Bereits eingerichtete Spielergeräte erhalten die aktive Saison sofort.
-- Die alte Membership bleibt als read-only Archivzugang erhalten.
INSERT INTO public.memberships (user_id, team_season_id, role)
SELECT DISTINCT
  player_users.user_id,
  public.resolve_player_access_team_season(players.id, players.team_season_id),
  'player'::public.membership_role
FROM public.player_users player_users
JOIN public.players players ON players.id = player_users.player_id
WHERE public.resolve_player_access_team_season(players.id, players.team_season_id) IS NOT NULL
ON CONFLICT (user_id, team_season_id)
DO UPDATE SET role = EXCLUDED.role
WHERE public.memberships.role::text IN ('fan', 'player');

SELECT pg_notify('pgrst', 'reload schema');
