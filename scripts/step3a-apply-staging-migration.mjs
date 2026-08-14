/**
 * STEP 3A: apply training library migration ONLY to staging (acbaecjzoabafbsjrzvr).
 * Requires SUPABASE_ACCESS_TOKEN in env. Never prints secrets.
 */
import fs from 'fs';

const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const VERSION = '20260808140000';
const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();

if (!token.startsWith('sbp_')) {
  console.error('ABORT: missing/invalid access token format');
  process.exit(1);
}
if (TARGET === LIVE) {
  console.error('ABORT: target equals live');
  process.exit(1);
}

const sqlPath = 'supabase/migrations/20260808140000_training_library_and_sessions.sql';
const sql = fs.readFileSync(sqlPath, 'utf8');

async function api(path, init) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  return { res, text };
}

const proj = JSON.parse((await api(`/projects/${TARGET}`)).text);
if (proj.name !== 'spielzeitapp-staging' || proj.id !== TARGET) {
  console.error('ABORT: staging identity mismatch', proj?.name, proj?.id);
  process.exit(1);
}
console.log('CONFIRMED_TARGET', proj.name, proj.id);
console.log('TARGET_IS_NOT_PRODUCTION=confirmed');

const live = JSON.parse((await api(`/projects/${LIVE}`)).text);
console.log('LIVE_UNTOUCHED_REF', live.id, live.name);

const pending = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({
    query: `SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260808130000' ORDER BY version;`,
  }),
});
console.log('STAGING_RECENT_MIGRATIONS', pending.res.status, pending.text.slice(0, 500));

const apply = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({ query: sql }),
});
console.log('APPLY_STATUS', apply.res.status);
console.log('APPLY_BODY', apply.text.slice(0, 600));
if (!apply.res.ok) process.exit(1);

const record = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({
    query: `
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('${VERSION}')
ON CONFLICT DO NOTHING;

SELECT
  to_regclass('public.training_exercises')::text AS training_exercises,
  to_regclass('public.training_sessions')::text AS training_sessions,
  to_regclass('public.training_session_exercises')::text AS training_session_exercises,
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${VERSION}'
  ) AS migration_recorded,
  (
    SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('training_exercises', 'training_sessions', 'training_session_exercises')
  ) AS policy_count;

NOTIFY pgrst, 'reload schema';
`,
  }),
});
console.log('VERIFY_STATUS', record.res.status);
console.log('VERIFY_BODY', record.text);
if (!record.res.ok) process.exit(1);

const liveCheck = await api(`/projects/${LIVE}/database/query`, {
  method: 'POST',
  body: JSON.stringify({
    query: `SELECT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${VERSION}'
    ) AS live_has_step3a_history,
    to_regclass('public.training_exercises')::text AS live_training_exercises;`,
  }),
});
console.log('LIVE_READONLY_CHECK', liveCheck.res.status, liveCheck.text.slice(0, 400));
