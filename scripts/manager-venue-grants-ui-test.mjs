/**
 * MANAGER-VENUE-GRANTS.UI.1 — Grant-Übersicht, Fields, Trainer-Schreibschutz.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function groupVenueGrantsByVenue(links) {
  const byId = new Map();
  for (const link of links) {
    if (!link.is_active || !link.venue_id) continue;
    const current = byId.get(link.venue_id) ?? {
      venueId: link.venue_id,
      venueName: (link.venue?.name ?? '').trim() || 'Anlage',
      training: false,
      homeMatch: false,
    };
    if ((link.venue?.name ?? '').trim()) current.venueName = String(link.venue.name).trim();
    if (link.purpose === 'home_match') current.homeMatch = true;
    else current.training = true;
    byId.set(link.venue_id, current);
  }
  return Array.from(byId.values()).sort((a, b) => a.venueName.localeCompare(b.venueName, 'de'));
}

function venuesAvailableForPurposeGrant(catalog, grouped, purpose) {
  const taken = new Set(
    grouped
      .filter((g) => (purpose === 'home_match' ? g.homeMatch : g.training))
      .map((g) => g.venueId),
  );
  return catalog.filter((v) => !taken.has(v.id));
}

function assignmentUsesVenueGrantPurpose(event, purpose) {
  const kind = String(event.kind ?? '').trim().toLowerCase();
  if (purpose === 'home_match') return kind === 'match' && event.is_home === true;
  return kind === 'training' || (kind !== 'match' && kind !== 'game');
}

function canManageVenueGrants(backendRole, effectiveRole) {
  return (
    String(backendRole ?? '').trim().toLowerCase() === 'admin' ||
    String(effectiveRole ?? '').trim().toLowerCase() === 'admin'
  );
}

const rohrbach = 'rohrbach';
const stveit = 'stveit';
const grouped = groupVenueGrantsByVenue([
  { venue_id: rohrbach, purpose: 'training', is_active: true, venue: { name: 'Sportplatz Rohrbach' } },
  { venue_id: rohrbach, purpose: 'home_match', is_active: true, venue: { name: 'Sportplatz Rohrbach' } },
  { venue_id: stveit, purpose: 'training', is_active: true, venue: { name: 'Sportplatz St. Veit' } },
  { venue_id: stveit, purpose: 'home_match', is_active: true, venue: { name: 'Sportplatz St. Veit' } },
  { venue_id: 'kirnberg', purpose: 'training', is_active: false, venue: { name: 'Kirnberg' } },
]);

assert.strictEqual(grouped.length, 2);
assert.deepStrictEqual(
  grouped.map((g) => g.venueName),
  ['Sportplatz Rohrbach', 'Sportplatz St. Veit'],
);
assert.ok(grouped.every((g) => g.training && g.homeMatch));
assert.ok(!grouped.some((g) => /Kirnberg|Kilb|Loosdorf|Weinburg/i.test(g.venueName)));

const fieldsRohrbach = ['Hauptplatz/Matchplatz', 'Trainingsplatz'];
assert.ok(fieldsRohrbach.includes('Hauptplatz/Matchplatz'));
assert.ok(fieldsRohrbach.includes('Trainingsplatz'));

const catalog = [
  { id: rohrbach, name: 'Sportplatz Rohrbach' },
  { id: stveit, name: 'Sportplatz St. Veit' },
];
assert.deepStrictEqual(
  venuesAvailableForPurposeGrant(catalog, grouped, 'training').map((v) => v.id),
  [],
);
assert.deepStrictEqual(venuesAvailableForPurposeGrant(catalog, grouped, 'training').length, 0);

assert.strictEqual(assignmentUsesVenueGrantPurpose({ kind: 'training' }, 'training'), true);
assert.strictEqual(assignmentUsesVenueGrantPurpose({ kind: 'match', is_home: true }, 'home_match'), true);
assert.strictEqual(assignmentUsesVenueGrantPurpose({ kind: 'match', is_home: false }, 'home_match'), false);
assert.strictEqual(assignmentUsesVenueGrantPurpose({ kind: 'match', is_home: true }, 'training'), false);

assert.strictEqual(canManageVenueGrants('admin', 'trainer'), true);
assert.strictEqual(canManageVenueGrants('trainer', 'trainer'), false);
assert.strictEqual(canManageVenueGrants('head_coach', 'trainer'), false);
assert.strictEqual(canManageVenueGrants('', 'admin'), true);

const detail = read('src/manager/ManagerClubDetailPage.tsx');
assert.ok(detail.includes('Anlagenkatalog / zugeordnete Anlagen'));
assert.ok(detail.includes('Für Trainer auswählbar sind nur die unten'));
assert.ok(detail.includes('ManagerClubVenueGrantsPanel'));
assert.ok(detail.includes('Freigegebene Anlagen') || read('src/manager/ManagerClubVenueGrantsPanel.tsx').includes('Freigegebene Anlagen und Plätze'));
assert.ok(!detail.includes('Anlagen (club_id)'));
assert.ok(!detail.includes('Keine Anlagen mit diesem club_id'));

const panel = read('src/manager/ManagerClubVenueGrantsPanel.tsx');
assert.ok(panel.includes('adminSetTeamSeasonVenueGrant'));
assert.ok(panel.includes('listTrainingVenuesForTeamSeason'));
assert.ok(panel.includes('listVenueFields'));
assert.ok(panel.includes('listFieldZones'));
assert.ok(panel.includes('countFutureAssignmentsForVenueGrant'));
assert.ok(panel.includes('venuesAvailableForPurposeGrant'));
assert.ok(panel.includes('Training entziehen'));
assert.ok(panel.includes('Heimspiel entziehen'));
assert.ok(panel.includes('Weitere Anlage freigeben'));
assert.ok(panel.includes('Keine weitere eingerichtete Anlage verfügbar.'));
assert.ok(!/ec1ba01f|ec5f02b6|9c7a8741/.test(panel));

const helpers = read('src/lib/teamSeasonTrainingVenues.ts');
assert.ok(helpers.includes('groupVenueGrantsByVenue'));
assert.ok(helpers.includes('countFutureAssignmentsForVenueGrant'));
assert.ok(helpers.includes("rpc('is_venue_purpose_allowed_for_team_season'"));

const seasonsPanel = read('src/manager/ManagerTrainingVenuesPanel.tsx');
assert.ok(seasonsPanel.includes("trim().toLowerCase() === 'admin'"));
assert.ok(!seasonsPanel.includes('canPrepareNextSeason'));
assert.ok(seasonsPanel.includes('Nur ansehen'));

const sql = read('supabase/migrations/20260818150000_grant_manage_club_admin_only.sql');
assert.ok(sql.includes('can_manage_team_season_training_venues'));
assert.ok(sql.includes("lower(m.role::text) = 'admin'"));
assert.ok(!sql.includes("'trainer'"));
assert.ok(!sql.includes('INSERT INTO public.venues'));

const occupancy = read('src/lib/createFacilityOccupancy.ts');
assert.ok(occupancy.includes('listAllowedVenueRowsForPurpose'));
assert.ok(occupancy.includes('void opts.clubVenues'));
const picker = read('src/components/venues/VenuePicker.tsx');
assert.ok(picker.includes('listAllowedTrainingVenueRows'));
assert.ok(picker.includes('isAllowlistPurpose'));
const manager = read('src/manager/ManagerPlatzbelegungPage.tsx');
assert.ok(manager.includes('listAllowedVenueRowsForPurpose'));
assert.ok(manager.includes('grantCheck'));

assert.ok(read('supabase/migrations/20260812190000_staging_org1_platform_club_ops.sql').includes('ON CONFLICT (team_season_id, venue_id, purpose)'));

console.log('manager-venue-grants-ui-test: OK');
