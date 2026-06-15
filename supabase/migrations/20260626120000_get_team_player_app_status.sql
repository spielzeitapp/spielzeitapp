-- Spieler-App Status für Trainer-Übersicht (Eltern-Tab).
-- Liefert nur Status + letzte Anmeldung — kein login_code, keine PIN.

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
  FROM public.players AS p
  LEFT JOIN LATERAL (
    SELECT c.id, c.last_used_at, c.revoked_at
    FROM public.player_login_credentials AS c
    WHERE c.player_id = p.id
    ORDER BY c.updated_at DESC
    LIMIT 1
  ) AS plc ON true
  WHERE p.team_season_id = p_team_season_id
    AND coalesce(p.status, 'active') <> 'archived'
  ORDER BY
    p.jersey_number NULLS LAST,
    p.last_name NULLS LAST,
    p.first_name NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_team_player_app_status(uuid) IS
  'Spieler-App Status je Kader-Spieler für Staff (active/created/not_setup). Keine Codes/PINs.';

GRANT EXECUTE ON FUNCTION public.get_team_player_app_status(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
