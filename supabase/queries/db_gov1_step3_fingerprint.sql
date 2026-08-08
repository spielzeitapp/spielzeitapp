-- DB-GOV.1 PHASE 1: STEP 3A/3C fingerprint only (no STEP 4 / team_seasons completed_*)
-- READ-ONLY

SELECT 'table:' || c.relname || '|rls=' || CASE WHEN c.relrowsecurity THEN 'on' ELSE 'off' END
  || '|force=' || CASE WHEN c.relforcerowsecurity THEN 'on' ELSE 'off' END AS item
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('training_exercises', 'training_sessions', 'training_session_exercises')

UNION ALL
SELECT 'col:' || c.table_name || '.' || c.column_name
  || '|udt=' || c.udt_name
  || '|null=' || c.is_nullable
  || '|def=' || COALESCE(c.column_default, '-')
  || '|pos=' || c.ordinal_position::text
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('training_exercises', 'training_sessions', 'training_session_exercises')

UNION ALL
SELECT 'idx:' || i.indexname || '|def=' || md5(i.indexdef)
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND (
    i.tablename IN ('training_exercises', 'training_sessions', 'training_session_exercises')
    OR i.indexname LIKE 'idx_training_%'
  )

UNION ALL
SELECT 'con:' || con.conname
  || '|type=' || con.contype::text
  || '|rel=' || rel.relname
  || '|def=' || md5(pg_get_constraintdef(con.oid))
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND rel.relname IN ('training_exercises', 'training_sessions', 'training_session_exercises')
  AND con.contype IN ('c', 'f', 'u', 'p')

UNION ALL
SELECT 'pol:' || c.relname || '.' || pol.polname
  || '|cmd=' || pol.polcmd::text
  || '|roles=' || array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY (pol.polroles)), ',')
  || '|qual=' || md5(COALESCE(pg_get_expr(pol.polqual, pol.polrelid), ''))
  || '|with=' || md5(COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('training_exercises', 'training_sessions', 'training_session_exercises')

UNION ALL
SELECT 'fn:' || p.proname
  || '|args=' || pg_get_function_identity_arguments(p.oid)
  || '|vol=' || p.provolatile::text
  || '|sec=' || CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END
  || '|body=' || md5(COALESCE(p.prosrc, ''))
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'set_training_exercises_updated_at',
    'set_training_sessions_updated_at',
    'set_training_session_exercises_updated_at'
  )

UNION ALL
SELECT 'trg:' || t.tgname
  || '|rel=' || c.relname
  || '|enabled=' || t.tgenabled::text
  || '|fn=' || p.proname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND c.relname IN ('training_exercises', 'training_sessions', 'training_session_exercises')

ORDER BY 1;
