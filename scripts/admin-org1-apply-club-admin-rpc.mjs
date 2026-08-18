/**
 * Apply club-admin RPCs to Staging only (acbaecjzoabafbsjrzvr).
 * Never touches Production.
 */
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const STEPS = [
  {
    version: '20260818140000',
    sqlPath: join(root, 'supabase/migrations/20260818140000_admin_org1_club_admin_role_enum.sql'),
  },
  {
    version: '20260818140100',
    sqlPath: join(root, 'supabase/migrations/20260818140100_admin_org1_club_admin_assign.sql'),
  },
];

function runQuery(sql, filePath) {
  const args = ['supabase', 'db', 'query', '--linked'];
  if (filePath) {
    args.push('-f', `"${filePath}"`);
  } else {
    const tmp = join(root, 'supabase/.temp/club-admin-rpc-query.sql');
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

for (const step of STEPS) {
  const hist = runQuery(
    `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${step.version}';`,
  );
  if (hist.stdout.includes(step.version) && hist.stdout.includes('"version"')) {
    console.log('ALREADY_APPLIED', step.version);
    continue;
  }
  const apply = runQuery(null, step.sqlPath);
  console.log('APPLY', step.version, apply.status);
  if (apply.status !== 0) {
    console.error(apply.stdout.slice(0, 2000));
    console.error(apply.stderr.slice(0, 2000));
    process.exit(1);
  }
  const record = runQuery(
    `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${step.version}') ON CONFLICT DO NOTHING; SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${step.version}';`,
  );
  if (record.status !== 0 || !record.stdout.includes(step.version)) {
    console.error('ABORT: migration not recorded', step.version);
    process.exit(1);
  }
  console.log('RECORDED', step.version);
}

const verify = runQuery(`
SELECT
  EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='membership_role' AND e.enumlabel='admin') AS has_admin_enum,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='admin_assign_club_admin') AS has_assign,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='admin_lookup_user_by_email') AS has_lookup,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='admin_set_platform_admin') AS platform_rpc_untouched;
`);
console.log('VERIFY', verify.stdout.slice(0, 800));
if (!verify.stdout.includes('true')) {
  console.error('ABORT: verify failed');
  process.exit(1);
}
console.log('DONE');
