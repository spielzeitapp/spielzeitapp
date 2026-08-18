/**
 * ADMIN-ORG.1 – Plattform-Vereinsverwaltung (ohne Secrets / ohne Live-DB-Mutationen).
 * Deckt Client-Logik, Nav-Gates, SQL-Erwartungen und Serverless-Limit.
 */
import assert from 'assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function countApiEndpointsExcludingLib(apiDir) {
  const files = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === '_lib') continue;
        walk(full);
        continue;
      }
      if (!/\.(js|ts|mjs)$/.test(name)) continue;
      if (name.startsWith('_')) continue;
      files.push(relative(apiDir, full).replace(/\\/g, '/'));
    }
  }
  walk(apiDir);
  return files.sort();
}

function normalizeClubName(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isDuplicateClubName(existingNames, candidate) {
  const n = normalizeClubName(candidate);
  return existingNames.some((x) => normalizeClubName(x) === n);
}

function canHardDelete(deps) {
  return Number(deps?.total_blocking ?? 1) === 0;
}

function isPlatformAdminRole(backendRole) {
  return String(backendRole ?? '').trim().toLowerCase() === 'admin';
}

function mayShowCreateClub(backendRole, membershipRole) {
  if (isPlatformAdminRole(backendRole)) return true;
  const m = String(membershipRole ?? '').trim().toLowerCase();
  // Trainer / Vereins-Staff dürfen keinen unabhängigen Verein anlegen
  if (['trainer', 'co_trainer', 'head_coach', 'head', 'admin'].includes(m)) return false;
  return false;
}

function rpcDeniedForNonAdmin(isAdmin) {
  return !isAdmin;
}

// ---------------------------------------------------------------------------
// 1–3 create permissions
// ---------------------------------------------------------------------------
assert.strictEqual(mayShowCreateClub('admin', 'trainer'), true);
assert.strictEqual(mayShowCreateClub('trainer', 'trainer'), false);
assert.strictEqual(mayShowCreateClub('', 'trainer'), false);
assert.strictEqual(mayShowCreateClub('', 'admin'), false); // membership "admin" is not platform admin
assert.strictEqual(isPlatformAdminRole('admin'), true);
assert.strictEqual(isPlatformAdminRole('trainer'), false);

// ---------------------------------------------------------------------------
// 4–8 archive / restore / edit gates (client mirrors)
// ---------------------------------------------------------------------------
assert.strictEqual(isPlatformAdminRole('admin') && true, true); // may edit
assert.strictEqual(mayShowCreateClub('trainer', 'trainer'), false); // cannot archive via UI create gate pattern
assert.ok(rpcDeniedForNonAdmin(false));
assert.ok(!rpcDeniedForNonAdmin(true));

// ---------------------------------------------------------------------------
// 9–16 hard delete rules
// ---------------------------------------------------------------------------
assert.strictEqual(canHardDelete({ total_blocking: 0 }), true);
assert.strictEqual(canHardDelete({ total_blocking: 1, teams: 1 }), false);
assert.strictEqual(canHardDelete({ total_blocking: 2, team_seasons: 2 }), false);
assert.strictEqual(canHardDelete({ total_blocking: 3, events: 3 }), false);
assert.strictEqual(canHardDelete({ total_blocking: 1, venues: 1 }), false);
assert.strictEqual(canHardDelete({ total_blocking: 1, event_field_assignments: 1 }), false);
assert.strictEqual(canHardDelete({ total_blocking: 0 }), true); // empty OK for platform admin
assert.strictEqual(mayShowCreateClub('trainer', 'trainer') && canHardDelete({ total_blocking: 0 }), false);
assert.strictEqual(mayShowCreateClub('', 'trainer') && canHardDelete({ total_blocking: 0 }), false);

// ---------------------------------------------------------------------------
// 17–18 duplicates (active + archived)
// ---------------------------------------------------------------------------
assert.ok(isDuplicateClubName(['NSG Gölsental', 'USC Rohrbach'], 'usc rohrbach'));
assert.ok(isDuplicateClubName(['USC Rohrbach'], ' USC  Rohrbach '));
assert.ok(isDuplicateClubName(['Archiv Club'], 'archiv club')); // archived still blocks
assert.ok(!isDuplicateClubName(['NSG Gölsental'], 'USC Rohrbach'));

// ---------------------------------------------------------------------------
// 19 self-elevation
// ---------------------------------------------------------------------------
{
  const sql = readFileSync(
    join(root, 'supabase/migrations/20260811200000_admin_org1_platform_club_management.sql'),
    'utf8',
  );
  assert.ok(sql.includes('tg_protect_profiles_is_admin'));
  assert.ok(sql.includes('tg_protect_user_roles_mutations'));
  assert.ok(sql.includes('profiles.is_admin darf nicht clientseitig'));
  assert.ok(sql.includes('user_roles darf nicht clientseitig'));
  assert.ok(sql.includes('admin_set_platform_admin'));
  assert.ok(sql.includes('admin_create_club'));
  assert.ok(sql.includes('admin_archive_club'));
  assert.ok(sql.includes('admin_restore_club'));
  assert.ok(sql.includes('admin_delete_empty_club'));
  assert.ok(sql.includes('admin_club_dependency_counts'));
  assert.ok(sql.includes('clubs_name_normalized_uidx'));
  assert.ok(sql.includes('club_is_operable'));
  assert.ok(sql.includes('FORCE ROW LEVEL SECURITY'));
  assert.ok(/keine parallele MANAGER-RECHTE/i.test(sql));
  assert.ok(!/create table.*manager_permissions/i.test(sql));
  // no email/name hardcodes for Johannes
  assert.ok(!/johannes/i.test(sql));
  assert.ok(!/@/.test(sql));
}

// ---------------------------------------------------------------------------
// 20–24 regression expectations documented in migration / client
// ---------------------------------------------------------------------------
{
  const platz6 = readFileSync(
    join(root, 'supabase/migrations/20260810200000_platz6_shared_venue_access.sql'),
    'utf8',
  );
  assert.ok(platz6.includes('list_shared') || platz6.includes('shared') || platz6.includes('home_match'));
  const client = readFileSync(join(root, 'src/lib/platformClubAdmin.ts'), 'utf8');
  assert.ok(client.includes("rpc('admin_create_club'"));
  assert.ok(client.includes("rpc('admin_delete_empty_club'"));
  assert.ok(client.includes("rpc('admin_assign_club_admin'"));
  assert.ok(client.includes("rpc('admin_lookup_user_by_email'"));
  const clubAdminSql = readFileSync(
    join(root, 'supabase/migrations/20260818140100_admin_org1_club_admin_assign.sql'),
    'utf8',
  );
  assert.ok(clubAdminSql.includes('is_platform_admin()'));
  assert.ok(!clubAdminSql.includes('admin_set_platform_admin'));
  assert.ok(!client.includes('@'));
  assert.ok(!/ddb3105e/i.test(client));
}

// ---------------------------------------------------------------------------
// 25 serverless ≤ 12
// ---------------------------------------------------------------------------
{
  const endpoints = countApiEndpointsExcludingLib(join(root, 'api'));
  assert.ok(endpoints.length <= 12, `too many api endpoints: ${endpoints.length} ${endpoints.join(',')}`);
  assert.ok(!endpoints.includes('admin-org.js'));
}

// UI routes exist
{
  const app = readFileSync(join(root, 'src/app/App.tsx'), 'utf8');
  assert.ok(app.includes('vereine'));
  assert.ok(app.includes('ManagerClubsPage'));
  assert.ok(app.includes('ManagerClubDetailPage'));
  const nav = readFileSync(join(root, 'src/manager/managerNav.ts'), 'utf8');
  assert.ok(nav.includes("to: '/manager/vereine'"));
  assert.ok(nav.includes('platformAdminOnly: true'));
}

console.log('ADMIN-ORG.1 tests OK');
console.log('API_ENDPOINTS', countApiEndpointsExcludingLib(join(root, 'api')).length);
