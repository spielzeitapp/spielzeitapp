/**
 * STEP 2B: apply conflict-trigger fix ONLY to staging.
 */
import fs from 'fs';

const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const VERSION = '20260808130000';
const NAME = 'fix_field_assignment_conflict_trigger';
const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
if (!token.startsWith('sbp_')) process.exit(1);

const sql = fs.readFileSync(`supabase/migrations/${VERSION}_${NAME}.sql`, 'utf8');

async function api(path, init) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return { res, text: await res.text() };
}

const proj = JSON.parse((await api(`/projects/${TARGET}`)).text);
if (proj.name !== 'spielzeitapp-staging' || proj.id !== TARGET) {
  console.error('ABORT', proj);
  process.exit(1);
}
console.log('TARGET_OK', proj.name);
console.log('LIVE_REF_UNTOUCHED', LIVE);

const apply = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({ query: sql }),
});
console.log('APPLY', apply.res.status, apply.text.slice(0, 300));
if (!apply.res.ok) process.exit(1);

const record = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({
    query: `
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('${VERSION}', '${NAME}', ARRAY['applied via management API on staging STEP 2B'])
ON CONFLICT (version) DO NOTHING;
NOTIFY pgrst, 'reload schema';
SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('20260808120000','20260808130000') ORDER BY version;
`,
  }),
});
console.log('RECORD', record.res.status, record.text);
if (!record.res.ok) process.exit(1);
