/**
 * Apply ONLY parent self-service onboarding migration to Staging (acbaecjzoabafbsjrzvr).
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
const VERSION = '20260812120000';
const sqlPath = join(root, 'supabase/migrations/20260812120000_parent_self_service_onboarding.sql');

function runQuery(sql) {
  const r = spawnSync(`npx supabase db query --linked "${sql.replace(/"/g, '\\"')}"`, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function runFile(filePath) {
  const r = spawnSync(`npx supabase db query --linked -f "${filePath.replace(/"/g, '\\"')}"`, {
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
  process.exit(0);
}

const apply = runFile(sqlPath);
console.log('APPLY_STATUS', apply.status);
if (apply.status !== 0) {
  console.error(apply.stdout.slice(0, 2000));
  console.error(apply.stderr.slice(0, 2000));
  process.exit(1);
}
console.log('APPLY_OUT', apply.stdout.slice(0, 500));

const record = runQuery(
  `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${VERSION}') ON CONFLICT DO NOTHING; SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${VERSION}';`,
);
console.log('RECORD', record.stdout.slice(0, 400));
if (record.status !== 0 || !record.stdout.includes(VERSION)) {
  console.error('ABORT: migration not recorded');
  process.exit(1);
}

const verify = runQuery(`
SELECT
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='list_parent_onboarding_clubs') AS has_clubs,
  EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='link_parent_self_service') AS has_link;
`);
console.log('VERIFY', verify.stdout.slice(0, 800));
console.log('DONE');
