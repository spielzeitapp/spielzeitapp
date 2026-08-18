/**
 * Apply grant-manage SQL to Staging only. Never touches Production.
 */
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const VERSION = '20260818150000';
const sqlPath = join(root, 'supabase/migrations/20260818150000_grant_manage_club_admin_only.sql');

function runQuery(sql, filePath) {
  const args = ['supabase', 'db', 'query', '--linked'];
  if (filePath) args.push('-f', `"${filePath}"`);
  else {
    const tmp = join(root, 'supabase/.temp/grant-manage-query.sql');
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
SELECT pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'can_manage_team_season_training_venues';
`);
console.log('VERIFY_LEN', verify.stdout.length);
if (!/lower\\(m\\.role::text\\) = 'admin'/i.test(verify.stdout) && !verify.stdout.includes("= 'admin'")) {
  console.error('ABORT: function body not updated');
  console.error(verify.stdout.slice(0, 1500));
  process.exit(1);
}
console.log('DONE');
