import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260828043000_platform_admin_dashboard_modules.sql');
const client = read('src/lib/platformClubAdmin.ts');
const detail = read('src/manager/ManagerClubDetailPage.tsx');
const guard = read('src/manager/ManagerRouteGuard.tsx');
const header = read('src/manager/components/ManagerHeader.tsx');
const dashboard = read('src/manager/ManagerPlatformDashboardPage.tsx');

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.platform_modules/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.club_modules/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.platform_admin_audit_log/);
assert.match(migration, /Grundmodule sind immer aktiv/);
assert.match(migration, /public\.is_platform_admin\(\)/);
assert.match(migration, /admin_get_platform_dashboard/);
assert.match(migration, /admin_set_club_module/);
assert.match(migration, /admin_log_support_access/);
assert.doesNotMatch(migration, /shxugattqatahckhspwk/);

for (const key of ['dashboard', 'squad', 'players', 'parents', 'events', 'seasons', 'notifications', 'permissions']) {
  assert.match(migration, new RegExp(`\\('${key}',[\\s\\S]*?'core', true`), `core module missing: ${key}`);
}

assert.match(client, /admin_list_clubs_v2/);
assert.match(client, /club_effective_modules/);
assert.match(detail, /Grundausstattung ist immer aktiv/);
assert.match(detail, /Im Supportmodus öffnen/);
assert.match(header, /Änderungen werden als Plattformadmin protokolliert/);
assert.match(guard, /Modul nicht freigeschaltet/);
assert.match(dashboard, /Plattform-Dashboard/);
assert.match(dashboard, /Vereine im Überblick/);

console.log('platform-admin-dashboard-test: ok');
