-- =============================================================================
-- PRODUCTION PREFLIGHT-ONLY (READ-ONLY)
-- Projekt: spielzeitapp-nsg / shxugattqatahckhspwk
-- Domain:  https://spielzeitapp.at
--
-- NUR SELECT. Keine DO-Blöcke mit Writes. Kein BEGIN/COMMIT.
-- Bei fehlenden Tabellen: kein 42P01 (dynamische Prüfungen via to_regclass /
-- information_schema; optionale Detailzeilen nur wenn Tabelle existiert).
--
-- Danach bei READY:
--   supabase/queries/prod_trainer_venue_platz_apply_only.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Schema-Fingerprint
-- -----------------------------------------------------------------------------
SELECT
  current_database() AS db,
  to_regclass('public.venues') IS NOT NULL AS has_venues,
  to_regclass('public.venue_fields') IS NOT NULL AS has_venue_fields,
  to_regclass('public.venue_field_zones') IS NOT NULL AS has_venue_field_zones,
  to_regclass('public.event_field_assignments') IS NOT NULL AS has_assignments,
  to_regclass('public.team_venues') IS NOT NULL AS has_team_venues,
  to_regclass('public.team_season_training_venues') IS NOT NULL AS has_team_season_training_venues,
  to_regclass('public.team_season_home_defaults') IS NOT NULL AS has_home_defaults,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venue_field_zones' AND column_name = 'rect_x'
  ) AS has_zone_geometry_cols,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_shared_venue_occupancy') AS has_platz6_rpc,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_assign_club_admin') AS has_club_admin_rpc;

-- -----------------------------------------------------------------------------
-- 2) Aktive U12-Saison 2026/27 (Rohrbach / NSG / SPG / Gölsental)
-- -----------------------------------------------------------------------------
SELECT
  ts.id AS team_season_id,
  ts.status,
  ts.display_name,
  ts.age_group,
  t.id AS team_id,
  t.name AS team_name,
  c.id AS club_id,
  c.name AS club_name,
  s.id AS season_id,
  s.name AS season_name
FROM public.team_seasons ts
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
JOIN public.seasons s ON s.id = ts.season_id
WHERE ts.status = 'active'
  AND (
    coalesce(ts.age_group, '') ILIKE 'U12%'
    OR t.name ILIKE '%U12%'
    OR coalesce(ts.display_name, '') ILIKE '%U12%'
  )
  AND (
    c.name ILIKE '%Rohrbach%'
    OR c.name ILIKE '%NSG%'
    OR c.name ILIKE '%SPG%'
    OR c.name ILIKE '%Gölsental%'
    OR c.name ILIKE '%Goelsental%'
  )
  AND (
    s.name ILIKE '%2026/27%'
    OR s.name ILIKE '%2026%'
    OR s.name ILIKE '%26/27%'
  )
ORDER BY c.name, t.name, s.name;

-- -----------------------------------------------------------------------------
-- 3) Venues Rohrbach / St. Veit
-- -----------------------------------------------------------------------------
SELECT v.id, v.name, v.is_active, v.club_id, c.name AS club_name
FROM public.venues v
JOIN public.clubs c ON c.id = v.club_id
WHERE v.name ILIKE '%Rohrbach%'
   OR v.name ILIKE '%St.%Veit%'
   OR v.name ILIKE '%St Veit%'
ORDER BY v.name, c.name;

-- -----------------------------------------------------------------------------
-- 4) Erwartete Fields (Soll) vs Ist
-- -----------------------------------------------------------------------------
WITH expected(venue_key, field_label, match_names, field_type, sort_order) AS (
  VALUES
    ('rohrbach', 'Hauptplatz/Matchplatz', ARRAY['hauptplatz/matchplatz','hauptplatz','matchplatz'], 'main', 0),
    ('rohrbach', 'Trainingsplatz', ARRAY['trainingsplatz'], 'training', 10),
    ('stveit', 'Hauptplatz', ARRAY['hauptplatz'], 'main', 0),
    ('stveit', 'Kleiner Nebenplatz', ARRAY['kleiner nebenplatz','nebenplatz'], 'small', 10)
),
venues_map AS (
  SELECT
    CASE
      WHEN v.name ILIKE '%Rohrbach%' THEN 'rohrbach'
      WHEN v.name ILIKE '%St.%Veit%' OR v.name ILIKE '%St Veit%' THEN 'stveit'
    END AS venue_key,
    v.id AS venue_id,
    v.name AS venue_name,
    v.club_id
  FROM public.venues v
  WHERE v.name ILIKE '%Rohrbach%'
     OR v.name ILIKE '%St.%Veit%'
     OR v.name ILIKE '%St Veit%'
)
SELECT
  e.venue_key,
  vm.venue_name,
  e.field_label AS expected_field,
  e.field_type,
  e.sort_order,
  CASE
    WHEN to_regclass('public.venue_fields') IS NULL THEN 'table_missing'
    WHEN (
      SELECT count(*) FROM public.venue_fields vf
      WHERE vf.venue_id = vm.venue_id
        AND vf.is_active IS TRUE
        AND lower(btrim(vf.name)) = ANY (e.match_names)
    ) = 1 THEN 'active_ok'
    WHEN (
      SELECT count(*) FROM public.venue_fields vf
      WHERE vf.venue_id = vm.venue_id
        AND vf.is_active IS TRUE
        AND lower(btrim(vf.name)) = ANY (e.match_names)
    ) > 1 THEN 'active_ambiguous'
    WHEN (
      SELECT count(*) FROM public.venue_fields vf
      WHERE vf.venue_id = vm.venue_id
        AND vf.is_active IS NOT TRUE
        AND lower(btrim(vf.name)) = ANY (e.match_names)
    ) > 0 THEN 'inactive_exists_blocked'
    ELSE 'missing_will_create'
  END AS status
FROM expected e
LEFT JOIN venues_map vm ON vm.venue_key = e.venue_key
ORDER BY e.venue_key, e.sort_order;

-- -----------------------------------------------------------------------------
-- 5) Vorhandene Fields (aktiv + inaktiv) inkl. Zonenanzahl
-- Voraussetzung laut Live-Stand: public.venue_fields existiert.
-- -----------------------------------------------------------------------------
SELECT
  v.name AS venue_name,
  vf.id AS field_id,
  vf.name AS field_name,
  vf.field_type,
  vf.is_active,
  vf.sort_order,
  (
    SELECT count(*)::int FROM public.venue_field_zones z
    WHERE z.field_id = vf.id AND z.is_active IS TRUE
  ) AS active_zones
FROM public.venues v
LEFT JOIN public.venue_fields vf ON vf.venue_id = v.id
WHERE v.name ILIKE '%Rohrbach%'
   OR v.name ILIKE '%St.%Veit%'
   OR v.name ILIKE '%St Veit%'
ORDER BY v.name, vf.is_active DESC NULLS LAST, vf.sort_order NULLS LAST, vf.name;

-- -----------------------------------------------------------------------------
-- 6) Event-/Assignment-Baseline
-- -----------------------------------------------------------------------------
SELECT
  (SELECT count(*)::bigint FROM public.events) AS events_total,
  (SELECT count(*)::bigint FROM public.event_field_assignments) AS assignments_total;

-- -----------------------------------------------------------------------------
-- 7) Legacy team_venues (Live: Tabelle vorhanden)
-- -----------------------------------------------------------------------------
SELECT
  CASE WHEN to_regclass('public.team_venues') IS NULL THEN 'missing' ELSE 'present' END AS team_venues_status;

SELECT
  tv.id,
  c.name AS club_name,
  t.name AS team_name,
  v.name AS venue_name,
  tv.is_default
FROM public.team_venues tv
JOIN public.clubs c ON c.id = tv.club_id
LEFT JOIN public.teams t ON t.id = tv.team_id
JOIN public.venues v ON v.id = tv.venue_id
WHERE tv.team_id IS NOT NULL
  AND (
    v.name ILIKE '%Rohrbach%'
    OR v.name ILIKE '%St.%Veit%'
    OR v.name ILIKE '%St Veit%'
    OR t.name ILIKE '%U12%'
  )
ORDER BY c.name, t.name, v.name;

-- -----------------------------------------------------------------------------
-- 8) Saisonbezogene Grants – nur Status (Tabelle fehlt auf Live vor Apply)
-- Kein FROM auf team_season_training_venues → kein 42P01
-- -----------------------------------------------------------------------------
SELECT
  CASE
    WHEN to_regclass('public.team_season_training_venues') IS NULL
      THEN 'missing (erwartet vor Apply – wird in apply_only angelegt)'
    ELSE 'present'
  END AS grant_table_status;

-- -----------------------------------------------------------------------------
-- 9) Dubletten / Zähler
-- -----------------------------------------------------------------------------
SELECT 'venues_rohrbach' AS check_name, count(*)::int AS n
FROM public.venues WHERE name ILIKE '%Rohrbach%'
UNION ALL
SELECT 'venues_st_veit', count(*)::int
FROM public.venues WHERE name ILIKE '%St.%Veit%' OR name ILIKE '%St Veit%'
UNION ALL
SELECT 'u12_active_seasons', count(*)::int
FROM public.team_seasons ts
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
JOIN public.seasons s ON s.id = ts.season_id
WHERE ts.status = 'active'
  AND (coalesce(ts.age_group,'') ILIKE 'U12%' OR t.name ILIKE '%U12%' OR coalesce(ts.display_name,'') ILIKE '%U12%')
  AND (c.name ILIKE '%Rohrbach%' OR c.name ILIKE '%NSG%' OR c.name ILIKE '%SPG%' OR c.name ILIKE '%Gölsental%' OR c.name ILIKE '%Goelsental%')
  AND (s.name ILIKE '%2026%' OR s.name ILIKE '%26/27%')
UNION ALL
SELECT 'rohrbach_active_fields',
  CASE WHEN to_regclass('public.venue_fields') IS NULL THEN -1 ELSE (
    SELECT count(*)::int FROM public.venue_fields vf
    JOIN public.venues v ON v.id = vf.venue_id
    WHERE v.name ILIKE '%Rohrbach%' AND vf.is_active IS TRUE
  ) END
UNION ALL
SELECT 'stveit_active_fields',
  CASE WHEN to_regclass('public.venue_fields') IS NULL THEN -1 ELSE (
    SELECT count(*)::int FROM public.venue_fields vf
    JOIN public.venues v ON v.id = vf.venue_id
    WHERE (v.name ILIKE '%St.%Veit%' OR v.name ILIKE '%St Veit%') AND vf.is_active IS TRUE
  ) END;

-- -----------------------------------------------------------------------------
-- 10) READY / BLOCKED
-- fehlende Fields (= missing_will_create) blockieren Preflight NICHT:
-- Apply legt sie an. Blockiert: Uneindeutigkeit, inaktive Konflikte, Schema-Lücken.
-- -----------------------------------------------------------------------------
WITH expected(venue_key, match_names) AS (
  VALUES
    ('rohrbach', ARRAY['hauptplatz/matchplatz','hauptplatz','matchplatz']),
    ('rohrbach', ARRAY['trainingsplatz']),
    ('stveit', ARRAY['hauptplatz']),
    ('stveit', ARRAY['kleiner nebenplatz','nebenplatz'])
),
venues_map AS (
  SELECT
    CASE
      WHEN v.name ILIKE '%Rohrbach%' THEN 'rohrbach'
      WHEN v.name ILIKE '%St.%Veit%' OR v.name ILIKE '%St Veit%' THEN 'stveit'
    END AS venue_key,
    v.id AS venue_id
  FROM public.venues v
  WHERE v.name ILIKE '%Rohrbach%'
     OR v.name ILIKE '%St.%Veit%'
     OR v.name ILIKE '%St Veit%'
),
field_status AS (
  SELECT
    e.venue_key,
    CASE
      WHEN to_regclass('public.venue_fields') IS NULL THEN 'table_missing'
      WHEN vm.venue_id IS NULL THEN 'venue_missing'
      WHEN (
        SELECT count(*) FROM public.venue_fields vf
        WHERE vf.venue_id = vm.venue_id AND vf.is_active IS TRUE
          AND lower(btrim(vf.name)) = ANY (e.match_names)
      ) > 1 THEN 'active_ambiguous'
      WHEN (
        SELECT count(*) FROM public.venue_fields vf
        WHERE vf.venue_id = vm.venue_id AND vf.is_active IS TRUE
          AND lower(btrim(vf.name)) = ANY (e.match_names)
      ) = 1 THEN 'active_ok'
      WHEN (
        SELECT count(*) FROM public.venue_fields vf
        WHERE vf.venue_id = vm.venue_id AND vf.is_active IS NOT TRUE
          AND lower(btrim(vf.name)) = ANY (e.match_names)
      ) > 0 THEN 'inactive_exists_blocked'
      ELSE 'missing_will_create'
    END AS status
  FROM expected e
  LEFT JOIN venues_map vm ON vm.venue_key = e.venue_key
),
counts AS (
  SELECT
    (SELECT count(*)::int FROM public.venues WHERE name ILIKE '%Rohrbach%') AS n_rh,
    (SELECT count(*)::int FROM public.venues WHERE name ILIKE '%St.%Veit%' OR name ILIKE '%St Veit%') AS n_sv,
    (
      SELECT count(*)::int
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      JOIN public.clubs c ON c.id = t.club_id
      JOIN public.seasons s ON s.id = ts.season_id
      WHERE ts.status = 'active'
        AND (coalesce(ts.age_group,'') ILIKE 'U12%' OR t.name ILIKE '%U12%' OR coalesce(ts.display_name,'') ILIKE '%U12%')
        AND (c.name ILIKE '%Rohrbach%' OR c.name ILIKE '%NSG%' OR c.name ILIKE '%SPG%' OR c.name ILIKE '%Gölsental%' OR c.name ILIKE '%Goelsental%')
        AND (s.name ILIKE '%2026%' OR s.name ILIKE '%26/27%')
    ) AS n_u12,
    to_regclass('public.venues') IS NOT NULL AS has_venues,
    to_regclass('public.venue_fields') IS NOT NULL AS has_fields,
    to_regclass('public.venue_field_zones') IS NOT NULL AS has_zones,
    to_regclass('public.event_field_assignments') IS NOT NULL AS has_assign
)
SELECT
  CASE
    WHEN NOT (SELECT has_venues AND has_fields AND has_zones AND has_assign FROM counts)
      THEN 'BLOCKED'
    WHEN (SELECT n_rh <> 1 OR n_sv <> 1 OR n_u12 <> 1 FROM counts)
      THEN 'BLOCKED'
    WHEN EXISTS (
      SELECT 1 FROM field_status
      WHERE status IN ('active_ambiguous', 'inactive_exists_blocked', 'table_missing', 'venue_missing')
    ) THEN 'BLOCKED'
    ELSE 'READY'
  END AS verdict,
  (SELECT n_u12 FROM counts) AS u12_seasons,
  (SELECT n_rh FROM counts) AS venues_rohrbach,
  (SELECT n_sv FROM counts) AS venues_st_veit,
  (SELECT count(*) FILTER (WHERE status = 'missing_will_create') FROM field_status) AS fields_missing_ok_to_create,
  (SELECT count(*) FILTER (WHERE status = 'active_ok') FROM field_status) AS fields_already_active,
  (SELECT count(*) FILTER (WHERE status = 'inactive_exists_blocked') FROM field_status) AS fields_inactive_blocked,
  (SELECT count(*) FILTER (WHERE status = 'active_ambiguous') FROM field_status) AS fields_ambiguous_blocked,
  CASE
    WHEN NOT (SELECT has_venues AND has_fields AND has_zones AND has_assign FROM counts)
      THEN 'Basis-Tabellen fehlen'
    WHEN (SELECT n_u12 FROM counts) <> 1 THEN 'U12-Saison nicht eindeutig'
    WHEN (SELECT n_rh FROM counts) <> 1 THEN 'Rohrbach-Venue nicht eindeutig'
    WHEN (SELECT n_sv FROM counts) <> 1 THEN 'St.Veit-Venue nicht eindeutig'
    WHEN EXISTS (SELECT 1 FROM field_status WHERE status = 'inactive_exists_blocked')
      THEN 'Inaktive Fields blockieren Auto-Seed – manuell klären'
    WHEN EXISTS (SELECT 1 FROM field_status WHERE status = 'active_ambiguous')
      THEN 'Mehrdeutige aktive Fields – manuell klären'
    WHEN EXISTS (SELECT 1 FROM field_status WHERE status = 'missing_will_create')
      THEN 'READY: fehlende Fields werden im Apply angelegt'
    ELSE 'READY: Schema/Venues/U12 ok, Fields vorhanden oder anlegbar'
  END AS reason;
