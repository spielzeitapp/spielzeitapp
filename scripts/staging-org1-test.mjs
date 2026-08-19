/**
 * STAGING-ORG.1 static regression checks.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const migration = read('supabase/migrations/20260812190000_staging_org1_platform_club_ops.sql');
const apply = read('scripts/staging-org1-apply.sql');
const cross = read('scripts/staging-org1-crossorg-occupancy.sql');
const client = read('src/lib/platformClubAdmin.ts');
const detail = read('src/manager/ManagerClubDetailPage.tsx');
const dto = read('src/lib/sharedVenueOccupancy.ts');
const platz6 = read('supabase/migrations/20260810200000_platz6_shared_venue_access.sql');

assert.ok(migration.includes('admin_create_team'));
assert.ok(migration.includes('admin_ensure_team_season'));
assert.ok(migration.includes('admin_assign_team_season_staff'));
assert.ok(migration.includes('admin_set_team_season_venue_grant'));
assert.ok(migration.includes('admin_list_grantable_venues'));
assert.ok(migration.includes('is_platform_admin()'));
assert.ok(!migration.includes('INSERT INTO public.venues'));

assert.ok(apply.includes("U13 TEST USC Rohrbach"));
assert.ok(!apply.includes('Johannes as USC head_coach'));
assert.ok(apply.includes('TRAINER-MODE.1A'));
assert.ok(apply.includes('home_match'));
assert.ok(apply.includes('training'));
assert.ok(apply.includes("ec1ba01f-cc58-4c91-b524-463b510ca339"));
assert.ok(apply.includes('ON CONFLICT (team_season_id, venue_id, purpose)'));
assert.ok(apply.includes("TEST U13 Auswärtsspiel"));
assert.ok(apply.includes('DELETE FROM public.event_field_assignments WHERE event_id = v_evt'));
assert.ok(!apply.includes('shxugattqatahckhspwk'));

assert.ok(cross.includes('TEST NSG Occupancy – Cross-Org'));
assert.ok(cross.includes('find_event_field_assignment_conflicts_internal'));

assert.ok(client.includes('adminCreateTeam'));
assert.ok(client.includes('adminEnsureTeamSeason'));
assert.ok(client.includes('adminAssignTeamSeasonStaff'));
assert.ok(client.includes('adminSetTeamSeasonVenueGrant'));
assert.ok(client.includes('adminListGrantableVenues'));

assert.ok(detail.includes('Struktur &amp; Freigaben') || detail.includes('Struktur & Freigaben'));
assert.ok(detail.includes('adminCreateTeam'));
assert.ok(detail.includes('ManagerClubVenueGrantsPanel') || detail.includes('Freigegebene Anlagen und Plätze'));
assert.ok(detail.includes('Anlagenkatalog / zugeordnete Anlagen'));
assert.ok(!detail.includes('Anlagen (club_id)'));
const grantsPanel = read('src/manager/ManagerClubVenueGrantsPanel.tsx');
assert.ok(grantsPanel.includes('adminSetTeamSeasonVenueGrant'));
assert.ok(grantsPanel.includes('countFutureAssignmentsForVenueGrant'));
assert.ok(client.includes('adminSetTeamSeasonVenueGrant'));
assert.ok(detail.includes('Trainer zuordnen'));
assert.ok(!detail.includes('Mich zuordnen'));
assert.ok(detail.includes('adminAssignClubAdmin') || client.includes('adminAssignClubAdmin'));
assert.ok(!detail.includes('@jb-harmonikas') && !detail.includes('ddb3105e'));

assert.ok(dto.includes('team_name') || dto.includes('org_name') || platz6.includes('org_name'));
assert.ok(platz6.includes('list_shared_venue_occupancy'));
assert.ok(!platz6.includes('attendance'));
assert.ok(!/player_guardians|email|phone/i.test(platz6.match(/list_shared_venue_occupancy[\s\S]{0,1200}/)?.[0] ?? ''));

// Serverless function limit: count api endpoints excluding _lib
const apiRoot = path.join(root, 'api');
function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('_')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (/\.(js|ts)$/.test(ent.name) && ent.name !== '_vapid.js') acc.push(full);
  }
  return acc;
}
const endpoints = walk(apiRoot).filter((f) => !f.includes(`${path.sep}_lib${path.sep}`));
assert.ok(endpoints.length <= 12, `Serverless endpoints ${endpoints.length} > 12`);

console.log('staging-org1-test: OK', { serverless: endpoints.length });
