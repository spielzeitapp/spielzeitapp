/**
 * TRAINER-MODE.1 – Arbeitsmodus, Navigation, Route Guards, Platzfilter.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function resolveAvailableWorkModes(input) {
  const modes = [];
  const hasTrainer = input.memberships.some((m) =>
    ['trainer', 'co_trainer', 'head_coach', 'head'].includes(String(m.role ?? '').toLowerCase()),
  );
  const hasClubAdmin = input.memberships.some(
    (m) => String(m.role ?? '').toLowerCase() === 'admin',
  );
  const hasPlatform = String(input.backendRole ?? '').trim().toLowerCase() === 'admin';
  if (hasTrainer) modes.push('trainer');
  if (hasClubAdmin) modes.push('club_admin');
  if (hasPlatform) modes.push('platform_admin');
  return modes;
}

function resolveDefaultWorkMode(available) {
  if (available.includes('trainer')) return 'trainer';
  if (available.includes('platform_admin')) return 'platform_admin';
  if (available.includes('club_admin')) return 'club_admin';
  return 'trainer';
}

function filterTrainerStaffTeamSeasonIds(memberships) {
  return memberships
    .filter((m) => ['trainer', 'co_trainer', 'head_coach', 'head'].includes(String(m.role ?? '').toLowerCase()))
    .map((m) => m.team_season_id);
}

function navItemVisibleForWorkMode(item, mode) {
  if (mode === 'platform_admin') return true;
  if (item.platformAdminOnly) return false;
  if (mode === 'trainer' && item.hideInTrainerMode) return false;
  return true;
}

function isAdminOnlyManagerLocation(pathname, search) {
  if (pathname.startsWith('/manager/vereine')) return true;
  const tab = new URLSearchParams(search).get('tab');
  if (pathname.startsWith('/manager/platzbelegung') && tab === 'facilities') return true;
  return false;
}

function trainerVenueFilter(grantVenues, clubCatalog) {
  const ids = new Set(grantVenues.map((v) => v.id));
  return clubCatalog.filter((v) => ids.has(v.id));
}

function resolveTrainerTeamSeasonId(opts) {
  const seasons = opts.trainerTeamSeasons.filter((ts) => Boolean(ts.id));
  if (seasons.length === 0) return null;
  const validIds = new Set(seasons.map((ts) => ts.id));
  const stored = opts.storedId;
  if (stored && validIds.has(stored)) return stored;
  const active = seasons.filter((ts) => ts.status === 'active');
  if (active.length >= 1) return active[0].id;
  return seasons[0].id;
}

function isClubAdminMembershipRole(role) {
  return String(role ?? '').trim().toLowerCase() === 'admin';
}

// 1 reiner U12-Trainer startet in Traineransicht
const pureTrainer = resolveAvailableWorkModes({
  backendRole: '',
  memberships: [{ team_season_id: 'ts-u12', role: 'trainer' }],
});
assert.deepStrictEqual(pureTrainer, ['trainer']);
assert.strictEqual(resolveDefaultWorkMode(pureTrainer), 'trainer');

// 2 reiner Trainer sieht nur eigene Team-Saison
assert.deepStrictEqual(
  filterTrainerStaffTeamSeasonIds([
    { team_season_id: 'ts-u12', role: 'trainer' },
    { team_season_id: 'ts-u14', role: 'parent' },
  ]),
  ['ts-u12'],
);

// 3 reiner Trainer sieht keine Adminnavigation
const navVereine = { platformAdminOnly: true };
const navFacilities = { hideInTrainerMode: true };
assert.strictEqual(navItemVisibleForWorkMode(navVereine, 'trainer'), false);
assert.strictEqual(navItemVisibleForWorkMode(navFacilities, 'trainer'), false);
assert.strictEqual(navItemVisibleForWorkMode(navFacilities, 'platform_admin'), true);

// 4 direkter Adminroute
assert.strictEqual(isAdminOnlyManagerLocation('/manager/vereine', ''), true);
assert.strictEqual(isAdminOnlyManagerLocation('/manager/platzbelegung', '?tab=facilities'), true);
assert.strictEqual(isAdminOnlyManagerLocation('/manager/platzbelegung', ''), false);

// 5 reiner Trainer sieht keine USC-Testmannschaft (nur eigene Staff-Saisons)
const nsgTrainerSeasons = filterTrainerStaffTeamSeasonIds([
  { team_season_id: 'ts-nsg-u12', role: 'trainer' },
]);
assert.ok(!nsgTrainerSeasons.includes('ts-usc-u13'));

// 6 Trainer-Platzfilter nur Grants
const catalog = [
  { id: 'rohrbach', name: 'Sportplatz Rohrbach' },
  { id: 'stveit', name: 'Sportplatz St. Veit' },
  { id: 'kilb', name: 'Sportplatz Kilb' },
  { id: 'weinburg', name: 'Sportplatz Weinburg' },
];
const grants = [
  { id: 'rohrbach', name: 'Sportplatz Rohrbach' },
  { id: 'stveit', name: 'Sportplatz St. Veit' },
];
assert.deepStrictEqual(
  trainerVenueFilter(grants, catalog).map((v) => v.id).sort(),
  ['rohrbach', 'stveit'],
);

// 7 Plattformadmin ohne Trainer bleibt in Plattformverwaltung
const platformOnly = resolveAvailableWorkModes({ backendRole: 'admin', memberships: [] });
assert.deepStrictEqual(platformOnly, ['platform_admin']);
assert.strictEqual(resolveDefaultWorkMode(platformOnly), 'platform_admin');

// 8 Johannes mit beiden Rollen kann wechseln
const johannes = resolveAvailableWorkModes({
  backendRole: 'admin',
  memberships: [{ team_season_id: 'ts-u12', role: 'trainer' }],
});
assert.ok(johannes.includes('trainer'));
assert.ok(johannes.includes('platform_admin'));
assert.strictEqual(johannes.length, 2);

// 9 Plattformadmin ohne Trainer-Staff erzeugt keine Trainer-Team-Saison
const platformAdminOnlyTrainerIds = filterTrainerStaffTeamSeasonIds([]);
assert.deepStrictEqual(platformAdminOnlyTrainerIds, []);

// 9b Vereinsadmin ohne Trainer-Staff erzeugt keine Trainer-Team-Saison
const clubAdminOnlyTrainerIds = filterTrainerStaffTeamSeasonIds([
  { team_season_id: 'ts-u12', role: 'admin' },
]);
assert.deepStrictEqual(clubAdminOnlyTrainerIds, []);

// 9c Trainer mit zwei echten Staff-Zuordnungen
assert.deepStrictEqual(
  filterTrainerStaffTeamSeasonIds([
    { team_season_id: 'ts-u12', role: 'trainer' },
    { team_season_id: 'ts-u14', role: 'co_trainer' },
    { team_season_id: 'ts-usc-u13', role: 'admin' },
  ]).sort(),
  ['ts-u12', 'ts-u14'].sort(),
);

// 9d Gespeicherter Trainerkontext hat Vorrang
assert.strictEqual(
  resolveTrainerTeamSeasonId({
    storedId: 'ts-u12',
    trainerTeamSeasons: [
      { id: 'ts-u12', status: 'active' },
      { id: 'ts-usc-u13', status: 'active' },
    ],
  }),
  'ts-u12',
);

// 9e Moduswechsel: Plattform-USC darf nicht als Trainerkontext übernommen werden
assert.strictEqual(
  resolveTrainerTeamSeasonId({
    storedId: 'ts-u12',
    trainerTeamSeasons: [{ id: 'ts-u12', status: 'active' }],
  }),
  'ts-u12',
);
assert.strictEqual(
  resolveTrainerTeamSeasonId({
    storedId: 'ts-usc-u13',
    trainerTeamSeasons: [{ id: 'ts-u12', status: 'active' }],
  }),
  'ts-u12',
);

// 10 Vereinsadmin erhält keine Plattformverwaltung
const clubAdmin = resolveAvailableWorkModes({
  backendRole: '',
  memberships: [{ team_season_id: 'ts-u12', role: 'admin' }],
});
assert.deepStrictEqual(clubAdmin, ['club_admin']);
assert.ok(!clubAdmin.includes('platform_admin'));

// Static guards
const workModeTs = read('src/manager/managerWorkMode.ts');
assert.ok(workModeTs.includes('spielzeit_manager_work_mode'));
assert.ok(workModeTs.includes('spielzeit_manager_trainer_team_season'));
assert.ok(workModeTs.includes('resolveTrainerTeamSeasonId'));
assert.ok(workModeTs.includes('resolveEffectiveWorkMode'));
assert.ok(!workModeTs.includes('UPDATE public.user_roles'));

const ctx = read('src/manager/ManagerWorkModeContext.tsx');
assert.ok(ctx.includes('writeStoredWorkMode'));
assert.ok(ctx.includes('resolveTrainerTeamSeasonId'));
assert.ok(ctx.includes('selectTrainerTeamSeasonId'));
assert.ok(ctx.includes('contextTeamSeasons'));

const header = read('src/manager/components/ManagerHeader.tsx');
assert.ok(header.includes('Als Trainer arbeiten'));
assert.ok(header.includes('switchToAdministration'));
assert.ok(header.includes('selectTrainerTeamSeasonId'));

const sidebar = read('src/manager/components/ManagerSidebar.tsx');
assert.ok(sidebar.includes('navItemVisibleForWorkMode'));
assert.ok(sidebar.includes('hideInTrainerMode'));

const guard = read('src/manager/ManagerRouteGuard.tsx');
assert.ok(guard.includes('Für diesen Bereich fehlen dir die erforderlichen Rechte'));

const platz = read('src/manager/ManagerPlatzbelegungPage.tsx');
assert.ok(platz.includes('isTrainerMode'));
assert.ok(platz.includes('listAllowedVenueRowsForPurpose'));

const nav = read('src/manager/managerNav.ts');
assert.ok(nav.includes('hideInTrainerMode'));

console.log('manager-trainer-mode-test: OK');
