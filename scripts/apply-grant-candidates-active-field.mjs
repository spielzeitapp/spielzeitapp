/**
 * Apply MANAGER-VENUE-GRANTS.UI.2 SQL to Staging only. Never touches Production.
 */
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const VERSION = '20260818160000';
const sqlPath = join(root, 'supabase/migrations/20260818160000_grant_candidates_require_active_field.sql');

function runQuery(sql, filePath) {
  const args = ['supabase', 'db', 'query', '--linked'];
  if (filePath) args.push('-f', `"${filePath}"`);
  else {
    const tmp = join(root, 'supabase/.temp/grant-candidates-query.sql');
    fs.mkdirSync(join(root, 'supabase/.temp'), { recursive: true });
    fs.writeFileSync(tmp, sql, 'utf8');
    args.push('-f', `"${tmp}"`);
  }
  const r = spawnSync('npx', args, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const ref = fs.readFileSync(join(root, 'supabase/.temp/project-ref'), 'utf8').trim();
if (ref !== TARGET) {
  console.error('ABORT: linked project is not staging', ref);
  process.exit(1);
}
if (TARGET === LIVE) {
  console.error('ABORT: target equals live');
  process.exit(1);
}
console.log('CONFIRMED_TARGET', TARGET);

const hist = runQuery(
  `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${VERSION}';`,
);
if (hist.stdout.includes(VERSION) && hist.stdout.includes('"version"')) {
  console.log('ALREADY_APPLIED', VERSION);
} else {
  const apply = runQuery(null, sqlPath);
  console.log('APPLY', VERSION, apply.status);
  if (apply.status !== 0) {
    console.error(apply.stdout.slice(0, 2000));
    console.error(apply.stderr.slice(0, 2000));
    process.exit(1);
  }
  const record = runQuery(
    `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${VERSION}') ON CONFLICT DO NOTHING; SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${VERSION}';`,
  );
  if (record.status !== 0 || !record.stdout.includes(VERSION)) {
    console.error('ABORT: migration not recorded');
    process.exit(1);
  }
  console.log('RECORDED', VERSION);
}

const verify = runQuery(`
SELECT
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='venue_has_active_field') AS has_field_fn,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='list_club_team_season_ids') AS has_list_fn;
`);
console.log('VERIFY', verify.stdout.slice(0, 500));
if (!verify.stdout.includes('true')) {
  console.error('ABORT: functions missing');
  process.exit(1);
}

const fnBody = runQuery(`
SELECT pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'admin_list_grantable_venues';
`);
if (!fnBody.stdout.includes('venue_has_active_field')) {
  console.error('ABORT: admin_list_grantable_venues not filtered');
  process.exit(1);
}
console.log('DONE');
