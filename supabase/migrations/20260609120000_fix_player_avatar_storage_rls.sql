-- Fix player-avatars Storage RLS: coalesce(m.role, '') castet '' auf membership_role enum.
-- Gleiches sicheres Muster wie Trainer: can_manage_team_staff + Spieler-Pfad-Check.

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
    AND EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.id::text = v_player_id
        AND p.team_season_id = v_team_season_id
    );
END;
$$;

COMMENT ON FUNCTION public.player_avatar_storage_may_manage(text) IS
  'RLS helper: player-avatars at {teamSeasonId}/{playerId}.* or {teamSeasonId}/cutouts/{playerId}.* — uses can_manage_team_staff.';

SELECT pg_notify('pgrst', 'reload schema');
