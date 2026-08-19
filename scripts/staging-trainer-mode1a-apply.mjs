/**
 * TRAINER-MODE.1A: Staging-Datenbereinigung (acbaecjzoabafbsjrzvr only).
 * Entfernt Johannes' falsche USC-U13-Staff-Zuordnung.
 */
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const sqlPath = join(root, 'scripts/staging-trainer-mode1a-remove-johannes-usc-staff.sql');

function runQuery(sql, filePath) {
  const args = ['supabase', 'db', 'query', '--linked'];
  if (filePath) {
    args.push('-f', `"${filePath}"`);
  } else {
    const tmp = join(root, 'supabase/.temp/trainer-mode1a-query.sql');
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

const preflight = runQuery(`
SELECT m.role::text AS role, m.team_season_id, t.name AS team_name, c.name AS club_name
FROM public.memberships m
JOIN public.team_seasons ts ON ts.id = m.team_season_id
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
WHERE m.user_id = 'ddb3105e-1d96-49e3-b468-89db2c2520cf'
  AND lower(btrim(m.role::text)) IN ('head_coach', 'head', 'trainer', 'co_trainer', 'admin')
ORDER BY c.name, t.name;
`);
console.log('PREFLIGHT', preflight.stdout.slice(0, 1200));

const apply = runQuery(null, sqlPath);
console.log('APPLY_STATUS', apply.status);
if (apply.status !== 0) {
  console.error(apply.stdout.slice(0, 2000));
  console.error(apply.stderr.slice(0, 2000));
  process.exit(1);
}
console.log('APPLY_OUT', apply.stdout.slice(0, 1200));

const verify = runQuery(`
SELECT count(*)::int AS usc_u13_staff
FROM public.memberships m
JOIN public.team_seasons ts ON ts.id = m.team_season_id
JOIN public.teams t ON t.id = ts.team_id
JOIN public.clubs c ON c.id = t.club_id
WHERE m.user_id = 'ddb3105e-1d96-49e3-b468-89db2c2520cf'
  AND btrim(c.name) = 'USC Rohrbach'
  AND (
    btrim(coalesce(ts.display_name, '')) ILIKE '%U13%'
    OR btrim(coalesce(t.name, '')) ILIKE '%U13%'
    OR btrim(coalesce(ts.age_group, '')) = 'U13'
  )
  AND lower(btrim(m.role::text)) IN ('head_coach', 'head', 'trainer', 'co_trainer');
`);
console.log('VERIFY', verify.stdout.slice(0, 400));

if (verify.stdout.includes('"usc_u13_staff": 0') || verify.stdout.includes('"usc_u13_staff":0')) {
  console.log('DONE: keine USC-U13-Staff-Zuordnung mehr');
} else if (!verify.stdout.includes('usc_u13_staff')) {
  console.log('DONE: verify output ambiguous — prüfe APPLY_OUT');
} else {
  console.error('ABORT: USC-U13-Staff-Zuordnung noch vorhanden');
  process.exit(1);
}
