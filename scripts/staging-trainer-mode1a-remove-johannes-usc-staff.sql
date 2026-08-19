-- TRAINER-MODE.1A (NUR acbaecjzoabafbsjrzvr)
-- Entfernt die unbeabsichtigte Trainer-Staff-Zuordnung Johannes → TEST USC Rohrbach U13.
-- Plattformadmin, U12-Trainer, Vereinsadmin und USC-Testdaten bleiben unverändert.

DO $$
DECLARE
  v_admin uuid := 'ddb3105e-1d96-49e3-b468-89db2c2520cf';
  v_usc_ts uuid;
  v_deleted int := 0;
BEGIN
  SELECT ts.id INTO v_usc_ts
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  JOIN public.clubs c ON c.id = t.club_id
  WHERE btrim(c.name) = 'USC Rohrbach'
    AND (
      btrim(coalesce(ts.display_name, '')) ILIKE '%U13%'
      OR btrim(coalesce(t.name, '')) ILIKE '%U13%'
      OR btrim(coalesce(ts.age_group, '')) = 'U13'
    )
  ORDER BY ts.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_usc_ts IS NULL THEN
    RAISE NOTICE 'TRAINER-MODE.1A: keine USC-U13-Team-Saison gefunden — nichts zu entfernen';
    RETURN;
  END IF;

  DELETE FROM public.memberships
  WHERE user_id = v_admin
    AND team_season_id = v_usc_ts
    AND lower(btrim(role::text)) IN ('head_coach', 'head', 'trainer', 'co_trainer');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'TRAINER-MODE.1A: % Staff-Membership(s) entfernt (USC U13 %)', v_deleted, v_usc_ts;
END $$;

-- Verifikation (Ausgabe für Apply-Script)
SELECT m.role::text AS role, m.team_season_id, t.name AS team_name, c.name AS club_name, ts.status
FROM public.memberships m
JOIN public.team_seasons ts ON ts.id = m.team_season_id
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
WHERE m.user_id = 'ddb3105e-1d96-49e3-b468-89db2c2520cf'
  AND lower(btrim(m.role::text)) IN ('head_coach', 'head', 'trainer', 'co_trainer', 'admin')
ORDER BY c.name, t.name;
