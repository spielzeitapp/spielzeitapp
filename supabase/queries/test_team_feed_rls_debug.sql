-- Debug / Test (Supabase SQL Editor; JWT = eingeloggter User, sonst auth.uid() NULL)

SELECT auth.uid() AS auth_uid;

SELECT
  id,
  user_id,
  team_season_id,
  role,
  role::text AS role_as_text,
  lower(role::text) AS role_lower
FROM public.memberships
WHERE user_id = auth.uid();

-- INSERT-Policies auf team_feed_posts (nur Metadaten)
SELECT
  pol.polname,
  pol.polcmd,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'team_feed_posts'
  AND pol.polcmd = 'a';
