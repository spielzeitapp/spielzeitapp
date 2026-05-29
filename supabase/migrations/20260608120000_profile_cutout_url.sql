-- Profil-Hero: cutout_url für Spieler (players) und Trainer (profiles)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cutout_url text;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS cutout_url text;

COMMENT ON COLUMN public.profiles.cutout_url IS 'PNG/WebP-Freistellung für Profil-Hero (Trainer/Staff).';
COMMENT ON COLUMN public.players.cutout_url IS 'PNG/WebP-Freistellung für Profil-Hero (Spieler).';

-- Trainer: Staff-RPC um cutout_url erweitern (alte 8-Parameter-Version entfernen)
DROP FUNCTION IF EXISTS public.upsert_team_staff_member(uuid, uuid, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.upsert_team_staff_member(
  p_team_season_id uuid,
  p_user_id uuid,
  p_role text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_cutout_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(trim(coalesce(p_role, '')));
BEGIN
  IF p_team_season_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing team_season_id or user_id';
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF v_role NOT IN ('trainer', 'co_trainer', 'head_coach') THEN
    RAISE EXCEPTION 'invalid staff role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'account not found';
  END IF;

  INSERT INTO public.memberships (user_id, team_season_id, role)
  VALUES (p_user_id, p_team_season_id, v_role::public.membership_role)
  ON CONFLICT (user_id, team_season_id)
  DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.profiles
  SET
    first_name = COALESCE(NULLIF(trim(p_first_name), ''), first_name),
    last_name = COALESCE(NULLIF(trim(p_last_name), ''), last_name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    email = COALESCE(NULLIF(trim(p_email), ''), email),
    avatar_url = COALESCE(NULLIF(trim(p_avatar_url), ''), avatar_url),
    cutout_url = COALESCE(NULLIF(trim(p_cutout_url), ''), cutout_url)
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_team_staff_member(uuid, uuid, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_team_staff_member(uuid, uuid, text, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_team_staff_for_season(p_team_season_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  first_name text,
  last_name text,
  phone text,
  email text,
  avatar_url text,
  cutout_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.user_id,
    lower(trim(m.role::text)) AS role,
    p.first_name,
    p.last_name,
    p.phone,
    p.email,
    p.avatar_url,
    p.cutout_url
  FROM public.memberships AS m
  LEFT JOIN public.profiles AS p ON p.id = m.user_id
  WHERE m.team_season_id = p_team_season_id
    AND lower(trim(m.role::text)) IN ('trainer', 'co_trainer', 'head_coach')
    AND (
      public.is_admin()
      OR public.is_member_of_team_season(p_team_season_id)
    )
  ORDER BY
    CASE lower(trim(m.role::text))
      WHEN 'head_coach' THEN 0
      WHEN 'co_trainer' THEN 1
      WHEN 'trainer' THEN 2
      ELSE 9
    END,
    coalesce(p.last_name, ''),
    coalesce(p.first_name, '');
$$;

-- Storage: team-photos …/cutouts/{userId}.png
CREATE OR REPLACE FUNCTION public.staff_photo_storage_may_access_path(p_bucket_id text, p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_season_id uuid;
  v_folder text;
BEGIN
  IF p_bucket_id IS DISTINCT FROM 'team-photos' THEN
    RETURN false;
  END IF;

  v_folder := split_part(p_name, '/', 2);

  IF v_folder NOT IN ('staff', 'cutouts') THEN
    RETURN false;
  END IF;

  IF length(trim(split_part(p_name, '/', 1))) = 0 THEN
    RETURN false;
  END IF;

  BEGIN
    v_team_season_id := split_part(p_name, '/', 1)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  RETURN public.can_manage_team_staff(v_team_season_id);
END;
$$;

-- Storage: player-avatars …/cutouts/{playerId}.png
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
    v_player_id := split_part(split_part(p_name, '/', 3), '.', 1);
  ELSE
    v_player_id := split_part(v_folder, '.', 1);
  END IF;

  IF v_player_id IS NULL OR length(trim(v_player_id)) = 0 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.memberships m ON m.team_season_id = p.team_season_id
    WHERE p.id::text = v_player_id
      AND p.team_season_id = v_team_season_id
      AND m.user_id = auth.uid()
      AND lower(coalesce(m.role, '')) IN ('trainer', 'admin', 'co_trainer', 'head_coach')
  );
END;
$$;

COMMENT ON FUNCTION public.player_avatar_storage_may_manage(text) IS
  'RLS helper: player-avatars at {teamSeasonId}/{playerId}.* or {teamSeasonId}/cutouts/{playerId}.*';

REVOKE ALL ON FUNCTION public.player_avatar_storage_may_manage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_avatar_storage_may_manage(text) TO authenticated;

DROP POLICY IF EXISTS "player_avatars_trainer_admin_insert" ON storage.objects;
CREATE POLICY "player_avatars_trainer_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'player-avatars'
  AND public.player_avatar_storage_may_manage(name)
);

DROP POLICY IF EXISTS "player_avatars_trainer_admin_update" ON storage.objects;
CREATE POLICY "player_avatars_trainer_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'player-avatars'
  AND public.player_avatar_storage_may_manage(name)
)
WITH CHECK (
  bucket_id = 'player-avatars'
  AND public.player_avatar_storage_may_manage(name)
);

DROP POLICY IF EXISTS "player_avatars_trainer_admin_delete" ON storage.objects;
CREATE POLICY "player_avatars_trainer_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'player-avatars'
  AND public.player_avatar_storage_may_manage(name)
);

SELECT pg_notify('pgrst', 'reload schema');
