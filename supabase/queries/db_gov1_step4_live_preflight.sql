-- DB-GOV.1 — STEP 4 Live preflight (READ-ONLY). Never run UPDATE here.
-- Use before applying 20260808180000_step4_live_ddl_no_bulk_archive.sql

SELECT
  (SELECT count(*)::int FROM public.team_seasons WHERE status = 'active') AS active_total,
  (SELECT count(*)::int FROM (
     SELECT team_id FROM public.team_seasons WHERE status = 'active'
     GROUP BY team_id HAVING count(*) > 1
   ) d) AS teams_with_dup_active,
  (SELECT coalesce(sum(n - 1), 0)::int FROM (
     SELECT count(*)::int AS n FROM public.team_seasons WHERE status = 'active'
     GROUP BY team_id HAVING count(*) > 1
   ) x) AS rows_08170000_update_would_archive;

-- Technical only: team_id + counts (no PII)
SELECT team_id::text AS team_id, count(*)::int AS active_n
FROM public.team_seasons
WHERE status = 'active'
GROUP BY team_id
HAVING count(*) > 1
ORDER BY active_n DESC, team_id;

-- History gate: STEP 3 markers present, STEP 4 staging file NOT auto-applied as 08170000
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20260808140000', '20260808150000', '20260808170000', '20260808180000')
ORDER BY version;
