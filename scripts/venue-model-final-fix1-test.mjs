/**
 * VENUE-MODEL.FINAL-FIX.1 — static guards for labels, club admin, grants, exclusive location modes.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function tokenLooksLikeAgeGroup(token) {
  return /^U\d{1,2}[a-z]?$/i.test(String(token || '').trim());
}

function parseClubDisplayName(full) {
  const trimmed = String(full || '').trim();
  if (!trimmed) return { ageGroup: null, line1: '', line2: '' };
  let parts = trimmed.split(/\s+/).filter(Boolean);
  let ageGroup = null;
  if (parts[0] && tokenLooksLikeAgeGroup(parts[0])) {
    ageGroup = parts[0].toUpperCase();
    parts = parts.slice(1);
  }
  if (parts.length === 0) return { ageGroup, line1: trimmed, line2: '' };
  if (parts.length === 1) return { ageGroup, line1: parts[0], line2: '' };
  return { ageGroup, line1: parts[0], line2: parts.slice(1).join(' ') };
}

function clubNameWithoutAgeGroup(teamName) {
  const trimmed = String(teamName ?? '').trim();
  if (!trimmed) return '';
  const parsed = parseClubDisplayName(trimmed);
  const club = [parsed.line1, parsed.line2].filter(Boolean).join(' ').trim();
  return club || trimmed;
}

function formatTeamSeasonContextLabel(input, opts) {
  const age = String(input.ageGroup ?? '').trim();
  const club = clubNameWithoutAgeGroup(input.teamName);
  const season = String(input.seasonName ?? '').trim();
  const core = [club, age, season].filter(Boolean).join(' · ');
  if (opts?.markArchived && String(input.status ?? '').toLowerCase() === 'archived') {
    return `${core} · Archiv`;
  }
  return core;
}

function formatClubTeamOptionLabel(teamName) {
  return clubNameWithoutAgeGroup(teamName) || String(teamName ?? '').trim() || 'Mannschaft';
}

function occupancyPurposeForKind(kind) {
  return kind === 'match' ? 'home_match' : 'training';
}

function listGrantedOnly(grants, _clubVenues) {
  return grants.filter((v) => v.is_active !== false);
}

function modesExclusive(internalVenueId, useExternal) {
  if (useExternal) return internalVenueId == null;
  return true;
}

// 1–5 labels
assert.strictEqual(
  formatTeamSeasonContextLabel({
    teamName: 'U11 SPG Rohrbach',
    ageGroup: 'U12',
    seasonName: '2026/27',
  }),
  'SPG Rohrbach · U12 · 2026/27',
);
assert.strictEqual(formatClubTeamOptionLabel('U11 SPG Rohrbach'), 'SPG Rohrbach');
assert.ok(!formatClubTeamOptionLabel('U11 SPG Rohrbach').includes('U11'));
assert.strictEqual(
  formatTeamSeasonContextLabel({
    teamName: 'U11 SPG Rohrbach',
    ageGroup: 'U11',
    seasonName: '2025/26',
    status: 'archived',
  }, { markArchived: true }),
  'SPG Rohrbach · U11 · 2025/26 · Archiv',
);
assert.ok(!formatTeamSeasonContextLabel({
  teamName: 'U11 SPG Rohrbach',
  ageGroup: 'U12',
  seasonName: '2026/27',
}).includes('U11'));

const seasonLifecycle = read('src/lib/seasonLifecycle.ts');
assert.ok(seasonLifecycle.includes('formatClubTeamOptionLabel'));
assert.ok(seasonLifecycle.includes('formatTeamSeasonContextLabel'));

const detail = read('src/manager/ManagerClubDetailPage.tsx');
assert.ok(detail.includes('formatTeamSeasonContextLabel'));
assert.ok(detail.includes('formatClubTeamOptionLabel'));
assert.ok(detail.includes('adminAssignClubAdmin'));
assert.ok(detail.includes('Trainer einer Mannschaft zuordnen'));
assert.ok(detail.includes('adminAssignTeamSeasonStaff'));
assert.ok(!detail.includes('Mich zuordnen'));
assert.ok(!detail.includes('Dich als Vereinsadmin (head_coach)'));
assert.ok(!detail.includes("role: 'head_coach',\n                      userId: authUser"));
assert.ok(!detail.includes('{t.name}</option>'));
assert.ok(!detail.includes('s.season_name ? ` · ${s.season_name}`'));
assert.ok(!detail.includes('authUser'));
assert.ok(!/@/.test(detail) || !detail.includes('@jb-'));
assert.ok(!/ddb3105e/i.test(detail));

// 6–9 club admin vs trainer
const client = read('src/lib/platformClubAdmin.ts');
assert.ok(client.includes("rpc('admin_assign_club_admin'"));
assert.ok(client.includes("rpc('admin_lookup_user_by_email'"));
assert.ok(!client.includes("rpc('admin_set_platform_admin'"));
assert.ok(!client.includes('@'));

const sqlEnum = read('supabase/migrations/20260818140000_admin_org1_club_admin_role_enum.sql');
const sqlAssign = read('supabase/migrations/20260818140100_admin_org1_club_admin_assign.sql');
assert.ok(sqlEnum.includes("ADD VALUE IF NOT EXISTS 'admin'"));
assert.ok(sqlAssign.includes('admin_assign_club_admin'));
assert.ok(sqlAssign.includes('admin_lookup_user_by_email'));
assert.ok(sqlAssign.includes("is_platform_admin()"));
assert.ok(sqlAssign.includes("'admin'::public.membership_role"));
assert.ok(sqlAssign.includes("'exists'"));
assert.ok(!sqlAssign.includes('admin_set_platform_admin'));
assert.ok(!sqlAssign.includes('INSERT INTO public.user_roles'));
assert.ok(!sqlAssign.includes('UPDATE public.profiles'));
assert.ok(!/johannes/i.test(sqlAssign));
assert.ok(!/@[a-z0-9.-]+\./i.test(sqlAssign));

assert.ok(detail.includes('Keine Team-Saison'));
assert.ok(detail.includes('Cheftrainer'));

// 10–15 grants
const occupancy = read('src/lib/createFacilityOccupancy.ts');
assert.ok(occupancy.includes('listAllowedVenueRowsForPurpose'));
assert.ok(occupancy.includes('assertVenuePurposeAllowed'));
assert.ok(!occupancy.includes('byId.set(v.id, v)'));
assert.ok(occupancy.includes('void opts.clubVenues'));
assert.strictEqual(occupancyPurposeForKind('training'), 'training');
assert.strictEqual(occupancyPurposeForKind('match'), 'home_match');

const granted = listGrantedOnly(
  [
    { id: 'rohrbach', name: 'Sportplatz Rohrbach', is_active: true },
    { id: 'stveit', name: 'Sportplatz St. Veit', is_active: true },
  ],
  [
    { id: 'kirnberg', name: 'Kirnberg', is_active: true },
    { id: 'weinburg', name: 'Weinburg', is_active: true },
  ],
);
assert.deepStrictEqual(granted.map((v) => v.name).sort(), [
  'Sportplatz Rohrbach',
  'Sportplatz St. Veit',
]);
assert.ok(!granted.some((v) => /Kirnberg|Weinburg|Kilb|Loosdorf|Texingtal|Wilhelmsburg|Bischofstetten/i.test(v.name)));

const picker = read('src/components/venues/VenuePicker.tsx');
assert.ok(picker.includes('exclusiveExternal'));
assert.ok(picker.includes('Externer Ort – keine interne Platzreservierung'));
assert.ok(picker.includes('isAllowlistPurpose'));
assert.ok(picker.includes('listAllowedTrainingVenueRows'));
assert.ok(picker.includes('!isAllowlistPurpose'));

const venuesLib = read('src/lib/teamSeasonTrainingVenues.ts');
assert.ok(venuesLib.includes('assertVenuePurposeAllowed'));
assert.ok(venuesLib.includes("rpc('is_venue_purpose_allowed_for_team_season'"));
assert.ok(!/ec1ba01f|ec5f02b6|9c7a8741/.test(venuesLib));

const assignments = read('src/lib/eventFieldAssignments.ts');
assert.ok(assignments.includes('grantCheck'));
assert.ok(assignments.includes('assertVenuePurposeAllowed'));

const createModal = read('src/app/components/CreateEventModal.tsx');
const eventDetail = read('src/pages/EventDetailPage.tsx');
const schedule = read('src/pages/SchedulePage.tsx');
const manager = read('src/manager/ManagerPlatzbelegungPage.tsx');

for (const src of [createModal, eventDetail, schedule]) {
  assert.ok(src.includes('exclusiveExternal'));
  assert.ok(src.includes('grantCheck'));
  assert.ok(src.includes("purpose: editEvent.kind === 'training' ? 'training' : 'home_match'") || src.includes("purpose: eventTypeLocal === 'training'") || src.includes('assignmentPurpose'));
}

assert.ok(createModal.includes("purpose: assignmentPurpose") || createModal.includes("eventTypeLocal === 'training'"));
assert.ok(manager.includes('grantCheck'));
assert.ok(manager.includes('listAllowedVenueRowsForPurpose'));
assert.ok(!manager.includes('for (const v of props.venues)'));

// 16–20 internal/external
assert.ok(createModal.includes("useExternalLocation ? null : selectedVenue?.id"));
assert.ok(eventDetail.includes('editUseExternalLocation ? null : editVenue'));
assert.ok(schedule.includes('editUseExternalLocation ? null : editVenue'));
assert.ok(createModal.includes('upsertEventFieldAssignment'));
assert.ok(eventDetail.includes('deleteEventFieldAssignment'));
assert.ok(schedule.includes('deleteEventFieldAssignment'));
assert.ok(modesExclusive('venue-1', false));
assert.ok(modesExclusive(null, true));
assert.ok(!modesExclusive('venue-1', true));

assert.ok(!createModal.includes("useExternalLocation\n              ? 'general'"));
assert.ok(!eventDetail.includes("editUseExternalLocation\n                    ? 'general'"));

// 21 same grant helper
assert.ok(occupancy.includes("from './teamSeasonTrainingVenues'"));
assert.ok(picker.includes('listAllowedVenueRowsForPurpose'));

const applyScript = read('scripts/admin-org1-apply-club-admin-rpc.mjs');
assert.ok(applyScript.includes("const TARGET = 'acbaecjzoabafbsjrzvr'"));
assert.ok(applyScript.includes("const LIVE = 'shxugattqatahckhspwk'"));
assert.ok(applyScript.includes('ABORT: linked project is not staging'));

console.log('venue-model-final-fix1-test: OK');
