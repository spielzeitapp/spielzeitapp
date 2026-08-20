/**
 * MANAGER-VENUE-GRANTS.UI.2 — Grant-Kandidaten nur mit aktivem Field; Sichtbarkeit.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function venuesAvailableForPurposeGrant(catalog, grouped, purpose) {
  const taken = new Set(
    grouped
      .filter((g) => (purpose === 'home_match' ? g.homeMatch : g.training))
      .map((g) => g.venueId),
  );
  return catalog.filter((v) => !taken.has(v.id));
}

function grantCatalogRequiresActiveField(venues, fieldsByVenue) {
  return venues.filter((v) =>
    (fieldsByVenue.get(v.id) ?? []).some((f) => f.is_active !== false),
  );
}

function rejectGrantWithoutActiveField(isActive, hasActiveField) {
  if (!isActive) return null;
  if (!hasActiveField) {
    return 'Anlage ist nicht eingerichtet (kein aktiver Platz). Zuerst einen Platz anlegen.';
  }
  return null;
}

function listVisibleClubTeamSeasonIds(opts) {
  const { clubId, clubs, memberships, isPlatformAdmin } = opts;
  const clubSeasons = clubs[clubId] ?? [];
  if (isPlatformAdmin) return clubSeasons;
  const isClubAdmin = memberships.some(
    (m) => m.clubId === clubId && String(m.role ?? '').toLowerCase() === 'admin',
  );
  if (isClubAdmin) return clubSeasons;
  const staffRoles = new Set(['trainer', 'co_trainer', 'head_coach', 'head', 'admin']);
  return clubSeasons.filter((tsId) =>
    memberships.some(
      (m) =>
        m.clubId === clubId &&
        m.teamSeasonId === tsId &&
        staffRoles.has(String(m.role ?? '').toLowerCase()),
    ),
  );
}

function sessionTeamSeasonIds(memberships, isPlatformAdmin, allSeasonIds) {
  if (isPlatformAdmin) return allSeasonIds;
  return [...new Set(memberships.map((m) => m.teamSeasonId))];
}

// Synthetic club/season fixtures (keine echten IDs)
const CLUB_A = 'club-a';
const CLUB_B = 'club-b';
const TS_A_U12 = 'ts-a-u12';
const TS_A_U14 = 'ts-a-u14';
const TS_B_U13 = 'ts-b-u13';

const clubs = {
  [CLUB_A]: [TS_A_U12, TS_A_U14],
  [CLUB_B]: [TS_B_U13],
};

const fieldsByVenue = new Map([
  ['rohrbach', [{ name: 'Hauptplatz', is_active: true }]],
  ['stveit', [{ name: 'Hauptplatz', is_active: true }]],
  ['kilb', []],
  ['kirnberg', []],
  ['loosdorf', []],
  ['texingtal', []],
  ['weinburg', []],
  ['wilhelmsburg', []],
]);

const allVenues = [
  { id: 'rohrbach', name: 'Sportplatz Rohrbach', club_name: 'NSG' },
  { id: 'stveit', name: 'Sportplatz St. Veit', club_name: 'NSG' },
  { id: 'kilb', name: 'Sportplatz Kilb', club_name: 'NSG' },
  { id: 'kirnberg', name: 'Sportplatz Kirnberg', club_name: 'NSG' },
  { id: 'loosdorf', name: 'Sportplatz Loosdorf', club_name: 'NSG' },
  { id: 'texingtal', name: 'Sportplatz Texingtal', club_name: 'NSG' },
  { id: 'weinburg', name: 'Sportplatz Weinburg', club_name: 'NSG' },
  { id: 'wilhelmsburg', name: 'Sportplatz Wilhelmsburg', club_name: 'NSG' },
];

const grantable = grantCatalogRequiresActiveField(allVenues, fieldsByVenue);
assert.deepStrictEqual(
  grantable.map((v) => v.id).sort(),
  ['rohrbach', 'stveit'],
);

for (const away of ['kilb', 'kirnberg', 'loosdorf', 'texingtal', 'weinburg', 'wilhelmsburg']) {
  assert.ok(!grantable.some((v) => v.id === away), `${away} must not be grantable`);
}

const grouped = [
  { venueId: 'rohrbach', training: true, homeMatch: true },
  { venueId: 'stveit', training: true, homeMatch: true },
];
assert.deepStrictEqual(venuesAvailableForPurposeGrant(grantable, grouped, 'training'), []);
assert.deepStrictEqual(venuesAvailableForPurposeGrant(grantable, grouped, 'home_match'), []);

assert.strictEqual(rejectGrantWithoutActiveField(true, false), rejectGrantWithoutActiveField(true, false));
assert.ok(rejectGrantWithoutActiveField(true, false)?.includes('kein aktiver Platz'));
assert.strictEqual(rejectGrantWithoutActiveField(false, false), null);
assert.strictEqual(rejectGrantWithoutActiveField(true, true), null);

// Rolle: Trainer Club A → nur A-U12
const trainerA = [{ clubId: CLUB_A, teamSeasonId: TS_A_U12, role: 'trainer' }];
assert.deepStrictEqual(
  listVisibleClubTeamSeasonIds({ clubId: CLUB_A, clubs, memberships: trainerA, isPlatformAdmin: false }),
  [TS_A_U12],
);
assert.deepStrictEqual(
  listVisibleClubTeamSeasonIds({ clubId: CLUB_B, clubs, memberships: trainerA, isPlatformAdmin: false }),
  [],
);
assert.deepStrictEqual(
  sessionTeamSeasonIds(trainerA, false, [...clubs[CLUB_A], ...clubs[CLUB_B]]),
  [TS_A_U12],
);

// Vereinsadmin Club A → alle A-Saisons, kein Club B
const clubAdminA = [{ clubId: CLUB_A, teamSeasonId: TS_A_U12, role: 'admin' }];
assert.deepStrictEqual(
  listVisibleClubTeamSeasonIds({ clubId: CLUB_A, clubs, memberships: clubAdminA, isPlatformAdmin: false }),
  [TS_A_U12, TS_A_U14],
);
assert.deepStrictEqual(
  listVisibleClubTeamSeasonIds({ clubId: CLUB_B, clubs, memberships: clubAdminA, isPlatformAdmin: false }),
  [],
);

// Plattformadmin → Club A + Club B
const allSeasons = [...clubs[CLUB_A], ...clubs[CLUB_B]];
assert.deepStrictEqual(
  listVisibleClubTeamSeasonIds({ clubId: CLUB_A, clubs, memberships: [], isPlatformAdmin: true }),
  clubs[CLUB_A],
);
assert.deepStrictEqual(
  listVisibleClubTeamSeasonIds({ clubId: CLUB_B, clubs, memberships: [], isPlatformAdmin: true }),
  clubs[CLUB_B],
);
assert.deepStrictEqual(sessionTeamSeasonIds([], true, allSeasons), allSeasons);

const sql = read('supabase/migrations/20260818160000_grant_candidates_require_active_field.sql');
assert.ok(sql.includes('venue_has_active_field'));
assert.ok(sql.includes('admin_list_grantable_venues'));
assert.ok(sql.includes('admin_set_team_season_venue_grant'));
assert.ok(sql.includes('list_club_team_season_ids'));
assert.ok(sql.includes('can_read_team_season'));
assert.ok(sql.includes('is_club_admin_for_club'));
assert.ok(sql.includes('team_seasons_select'));
assert.ok(!/Sportplatz Kilb|Kirnberg|Loosdorf/i.test(sql));

const panel = read('src/manager/ManagerClubVenueGrantsPanel.tsx');
assert.ok(panel.includes('Keine weitere eingerichtete Anlage verfügbar.'));

const assignments = read('src/lib/eventFieldAssignments.ts');
assert.ok(assignments.includes("rpc('list_club_team_season_ids'"));

const platz6 = read('supabase/migrations/20260810200000_platz6_shared_venue_access.sql');
assert.ok(platz6.includes('Auswärtsspiele erhalten keine lokale Platzzuordnung'));

console.log('manager-venue-grants-ui2-test: OK');
