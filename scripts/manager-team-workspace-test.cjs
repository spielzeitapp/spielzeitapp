const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
 const file = path.resolve(root, relative);
 if (cache.has(file)) return cache.get(file);
 const module = { exports: {} };
 cache.set(file, module.exports);
 const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
 new Function('require', 'module', 'exports', js)(name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(file), name + '.ts'))) : require(name), module, module.exports);
 cache.set(file, module.exports);
 return module.exports;
}
const { resolveManagerTeamScope: scope } = load('src/manager/resolveManagerTeamScope.ts');
const u12 = { id: 'u12', team_id: 'team12', status: 'active', team: { id: 'team12', name: 'Testverein' } };
const u13 = { id: 'u13', team_id: 'team13', status: 'active', team: { id: 'team13', name: 'Testverein' } };
const archived = { ...u12, id: 'old12', status: 'archived' };
const session = { backendRole: 'admin', effectiveRole: 'fan', user: { id: 'test', role: 'fan' }, memberships: [ { team_season_id: 'u12', role: 'trainer' }, { team_season_id: 'u13', role: 'fan' }, { team_season_id: 'old12', role: 'trainer' } ], selectedTeamSeasonId: 'u13', viewTeamSeasonId: null, teamViewFilter: 'all' };
const admin = scope(session, 'platform_admin', [u12, u13]);
assert.equal(admin.effectiveRole, 'admin');
assert.equal(admin.selectedTeamSeason.id, 'u13');
assert.deepEqual(admin.filteredTeamSeasonIds, ['u13']);
assert.equal(admin.teamViewFilter, null);
assert.equal(session.effectiveRole, 'fan', 'App session must not change');
assert.equal(session.user.role, 'fan');
assert.equal(scope(session, 'trainer', [u12]), null, 'U12 trainer cannot select U13');
assert.equal(scope(session, 'trainer', [u12, u13]), null, 'Fan membership cannot become trainer');
assert.equal(scope({ ...session, selectedTeamSeasonId: 'u12' }, 'trainer', [u12]).effectiveRole, 'trainer', 'Global admin must not leak into trainer mode');
assert.equal(scope({ ...session, backendRole: 'fan' }, 'platform_admin', [u13]), null, 'Work mode alone cannot grant admin UI');
assert.equal(scope({ ...session, selectedTeamSeasonId: 'foreign' }, 'platform_admin', [u12, u13]), null, 'Unknown/stale context must be rejected');
const support = scope({ ...session, memberships: [], selectedTeamSeasonId: 'u13' }, 'platform_admin', [u13]);
assert.equal(support.viewTeamSeason.id, 'u13', 'Verified admin can work in the loaded club context without a team membership');
const history = scope({ ...session, selectedTeamSeasonId: 'u12', viewTeamSeasonId: 'old12' }, 'trainer', [u12, archived]);
assert.equal(history.viewTeamSeason.status, 'archived');
assert.equal(history.selectedTeamSeason.id, 'u12', 'Archive selection must retain the active write season');
const { MANAGER_NAV_SECTIONS } = load('src/manager/managerNav.ts');
const items = MANAGER_NAV_SECTIONS.flatMap(section => section.items);
for (const id of ['squad', 'players', 'parents', 'events', 'matches', 'tournaments', 'social', 'team-push', 'reminders']) {
 const item = items.find(item => item.id === id);
 assert.equal(item.status, 'ready', id);
 const route = item.to.replace('/manager/', '').split('?')[0];
 assert(fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8').includes(`path="${route}"`), `Missing Manager route: ${route}`);
}
console.log('Manager team workspace: role boundaries, archive context and all ready menu routes passed');
