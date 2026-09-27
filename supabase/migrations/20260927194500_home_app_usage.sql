-- A Home-screen installation cannot be queried. Record observed standalone opens only.
CREATE TABLE IF NOT EXISTS public.home_app_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_opened_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.home_app_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.home_app_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_home_app_open()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.home_app_usage (user_id, last_opened_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_opened_at = excluded.last_opened_at;
END $$;
REVOKE ALL ON FUNCTION public.record_home_app_open() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_home_app_open() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_team_parent_home_app_usage(p_team_season_id uuid)
RETURNS TABLE (user_id uuid, last_opened_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_team_season_id IS NULL OR NOT public.can_manage_team_staff(p_team_season_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT h.user_id, h.last_opened_at
  FROM public.team_season_players tsp
  JOIN public.player_guardians pg ON pg.player_id = tsp.player_id
  JOIN public.home_app_usage h ON h.user_id = pg.user_id
  WHERE tsp.team_season_id = p_team_season_id AND tsp.left_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.get_team_parent_home_app_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_parent_home_app_usage(uuid) TO authenticated;
