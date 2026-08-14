/**
 * STEP 2B: apply venue field migration ONLY to staging (acbaecjzoabafbsjrzvr).
 * Requires SUPABASE_ACCESS_TOKEN in env. Never prints secrets.
 */
import fs from 'fs';

const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();

if (!token.startsWith('sbp_')) {
  console.error('ABORT: missing/invalid access token format');
  process.exit(1);
}
if (TARGET === LIVE) {
  console.error('ABORT: target equals live');
  process.exit(1);
}

const sqlPath = 'supabase/migrations/20260808120000_venue_fields_and_event_assignments.sql';
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

const live = JSON.parse((await api(`/projects/${LIVE}`)).text);
console.log('LIVE_UNTOUCHED_REF', live.id, live.name);

const apply = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({ query: sql }),
});
console.log('APPLY_STATUS', apply.res.status);
console.log('APPLY_BODY', apply.text.slice(0, 400));
if (!apply.res.ok) process.exit(1);

const verifySql = `
SELECT
  to_regclass('public.venue_fields')::text AS venue_fields,
  to_regclass('public.venue_field_zones')::text AS venue_field_zones,
  to_regclass('public.event_field_assignments')::text AS event_field_assignments,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'find_event_field_assignment_conflicts'
  ) AS has_conflict_rpc,
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260808120000'
  ) AS migration_recorded;

NOTIFY pgrst, 'reload schema';
`;

const verify = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({ query: verifySql }),
});
console.log('VERIFY_STATUS', verify.res.status);
console.log('VERIFY_BODY', verify.text);
if (!verify.res.ok) process.exit(1);

// Live must remain unmodified by this script (read-only check)
const liveCheck = await api(`/projects/${LIVE}/database/query`, {
  method: 'POST',
  body: JSON.stringify({
    query: `SELECT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260808120000') AS live_has_step2_history;`,
  }),
});
console.log('LIVE_READONLY_CHECK', liveCheck.res.status, liveCheck.text);
