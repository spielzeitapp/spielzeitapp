-- =============================================================================
-- PRODUCTION READ-ONLY PREFLIGHT
-- Projekt: spielzeitapp-nsg (shxugattqatahckhspwk)
-- Domain: https://spielzeitapp.at
-- NUR LESEN. Keine Grants, keine Migrationen, keine Deletes.
-- Im Supabase Dashboard → SQL Editor ausführen und Ergebnis prüfen.
-- =============================================================================

-- A) Identität / Schema-Fingerprint
SELECT
  current_database() AS db,
  to_regclass('public.event_field_assignments') IS NOT NULL AS has_assignments,
  to_regclass('public.team_season_training_venues') IS NOT NULL AS has_grants,
  to_regclass('public.venue_field_zones') IS NOT NULL AS has_zones,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_shared_venue_occupancy') AS has_shared_rpc,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_venue_purpose_allowed_for_team_season') AS has_grant_check_rpc,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'find_event_field_assignment_conflicts') AS has_conflict_rpc,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_set_team_season_venue_grant') AS has_grant_set_rpc,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'venue_has_active_field') AS has_active_field_rpc,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_club_team_season_ids') AS has_list_club_ts_rpc,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_manage_team_season_training_venues') AS has_can_manage_grants,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_assign_club_admin') AS has_club_admin_rpc,
  EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'membership_role' AND e.enumlabel = 'admin'
  ) AS has_membership_role_admin;

-- B) U12-Saison 2026/27 (muss genau 1 Treffer sein)
SELECT
  ts.id AS team_season_id,
  ts.status,
  ts.display_name,
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
WHERE (
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

-- C) Venues Rohrbach / St. Veit (je Name eindeutig?)
SELECT v.id, v.name, v.is_active, v.club_id, c.name AS club_name
FROM public.venues v
JOIN public.clubs c ON c.id = v.club_id
WHERE v.name ILIKE '%Rohrbach%'
   OR v.name ILIKE '%St.%Veit%'
   OR v.name ILIKE '%St Veit%'
ORDER BY v.name, c.name;

-- D) Aktive Fields + Zonen-Anzahl
SELECT
  v.name AS venue_name,
  vf.id AS field_id,
  vf.name AS field_name,
  vf.is_active,
  count(z.id) FILTER (WHERE z.is_active IS TRUE)::int AS active_zones
FROM public.venues v
JOIN public.venue_fields vf ON vf.venue_id = v.id
LEFT JOIN public.venue_field_zones z ON z.field_id = vf.id
WHERE v.name ILIKE '%Rohrbach%'
   OR v.name ILIKE '%St.%Veit%'
   OR v.name ILIKE '%St Veit%'
GROUP BY v.name, vf.id, vf.name, vf.is_active
ORDER BY v.name, vf.name;

-- E) Bestehende Grants training / home_match für U12-Treffer
-- (nach Ausführung von Query B: team_season_id manuell einsetzen ODER Join nutzen)
SELECT
  g.id AS grant_id,
  g.team_season_id,
  g.purpose,
  g.is_active,
  g.venue_id,
  v.name AS venue_name,
  ts.display_name,
  t.name AS team_name
FROM public.team_season_training_venues g
JOIN public.venues v ON v.id = g.venue_id
JOIN public.team_seasons ts ON ts.id = g.team_season_id
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
WHERE (
  coalesce(ts.age_group, '') ILIKE 'U12%'
  OR t.name ILIKE '%U12%'
  OR coalesce(ts.display_name, '') ILIKE '%U12%'
)
AND (
  v.name ILIKE '%Rohrbach%'
  OR v.name ILIKE '%St.%Veit%'
  OR v.name ILIKE '%St Veit%'
)
ORDER BY ts.display_name, v.name, g.purpose;

-- F) Dubletten-Checks
SELECT 'venues_rohrbach' AS check_name, count(*)::int AS n
FROM public.venues WHERE name ILIKE '%Rohrbach%'
UNION ALL
SELECT 'venues_st_veit', count(*)::int
FROM public.venues WHERE name ILIKE '%St.%Veit%' OR name ILIKE '%St Veit%'
UNION ALL
SELECT 'u12_seasons_rohrbach_nsg', count(*)::int
FROM public.team_seasons ts
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
JOIN public.seasons s ON s.id = ts.season_id
WHERE (coalesce(ts.age_group,'') ILIKE 'U12%' OR t.name ILIKE '%U12%' OR coalesce(ts.display_name,'') ILIKE '%U12%')
  AND (c.name ILIKE '%Rohrbach%' OR c.name ILIKE '%NSG%' OR c.name ILIKE '%SPG%' OR c.name ILIKE '%Gölsental%' OR c.name ILIKE '%Goelsental%')
  AND (s.name ILIKE '%2026%');

-- G) TEST-USC darf keine Release-Voraussetzung sein (nur Info)
SELECT count(*)::int AS usc_or_test_teams
FROM public.teams t
JOIN public.clubs c ON c.id = t.club_id
WHERE c.name ILIKE '%USC Rohrbach%' OR t.name ILIKE '%TEST USC%' OR t.name ILIKE '%TEST%USC%';
