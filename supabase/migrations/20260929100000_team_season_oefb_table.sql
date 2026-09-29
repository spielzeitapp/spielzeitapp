-- ÖFB-Tabelle wird der konkreten Mannschaftssaison zugeordnet.
-- Keine Änderung an Events, Kader oder bestehenden Rollen.
ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS oefb_table_competition_id text,
  ADD COLUMN IF NOT EXISTS oefb_table_url text,
  ADD COLUMN IF NOT EXISTS oefb_table_team_name text;

-- Den bisherigen U13-Pilotbewerb ohne sichtbare Änderung übernehmen.
UPDATE public.team_seasons AS ts
SET oefb_table_competition_id = '232775',
    oefb_table_url = 'https://www.oefb.at/bewerbe/Bewerb/232775?JHG-West-Mitte-U13-OPO',
    oefb_table_team_name = 'SPG Rohrbach'
FROM public.seasons AS s
WHERE ts.season_id = s.id
  AND ts.team_id = '1ebe3d18-78ff-4986-a0b2-31cc1b7af938'::uuid
  AND ts.age_group ~* '^U[[:space:]]*13($|[^0-9])'
  AND s.name LIKE '%2026/27%'
  AND ts.oefb_table_competition_id IS NULL;

-- Die bestehende team_seasons-UPDATE-Policy erlaubt auch Team-Staff andere
-- Saisonfelder. Nur diese drei neuen Felder bleiben Plattformadmins vorbehalten.
CREATE OR REPLACE FUNCTION public.protect_team_season_oefb_table_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.oefb_table_competition_id, NEW.oefb_table_url, NEW.oefb_table_team_name)
     IS DISTINCT FROM
     (OLD.oefb_table_competition_id, OLD.oefb_table_url, OLD.oefb_table_team_name)
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin darf die ÖFB-Tabelle zuordnen.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_team_season_oefb_table_settings ON public.team_seasons;
CREATE TRIGGER trg_protect_team_season_oefb_table_settings
BEFORE UPDATE OF oefb_table_competition_id, oefb_table_url, oefb_table_team_name
ON public.team_seasons
FOR EACH ROW EXECUTE FUNCTION public.protect_team_season_oefb_table_settings();

CREATE OR REPLACE FUNCTION public.admin_set_team_season_oefb_table(
  p_team_season_id uuid,
  p_url text,
  p_team_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := btrim(coalesce(p_url, ''));
  v_team_name text := btrim(coalesce(p_team_name, ''));
  v_match text[];
  v_id text;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin darf die ÖFB-Tabelle zuordnen.' USING ERRCODE = '42501';
  END IF;

  IF v_url = '' AND v_team_name = '' THEN
    v_id := NULL;
    v_url := NULL;
    v_team_name := NULL;
  ELSE
    v_match := regexp_match(v_url, '^https://www\.oefb\.at/bewerbe/Bewerb/([0-9]{1,10})/?(\?[^[:space:]]*)?$', 'i');
    IF v_match IS NULL OR v_team_name = '' OR length(v_team_name) > 120 THEN
      RAISE EXCEPTION 'Gültigen ÖFB-Bewerbslink und Mannschaftsnamen angeben.' USING ERRCODE = '22023';
    END IF;
    v_id := v_match[1];
  END IF;

  UPDATE public.team_seasons
  SET oefb_table_competition_id = v_id,
      oefb_table_url = v_url,
      oefb_table_team_name = v_team_name
  WHERE id = p_team_season_id
  RETURNING jsonb_build_object(
    'competition_id', oefb_table_competition_id,
    'source_url', oefb_table_url,
    'team_name', oefb_table_team_name
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Mannschaftssaison nicht gefunden.' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_team_season_oefb_table(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_team_season_oefb_table(uuid, text, text) TO authenticated;
SELECT pg_notify('pgrst', 'reload schema');
