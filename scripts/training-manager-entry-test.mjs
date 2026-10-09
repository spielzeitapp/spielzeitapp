import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/manager/trainingManagerEntry.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm' });
const { trainingPlanManagerHref, resolveTrainingTrainerEntry } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const sessionId = '10000000-0000-4000-8000-000000000001';
const teamSeasonId = '20000000-0000-4000-8000-000000000002';
const eventId = '30000000-0000-4000-8000-000000000003';
const input = { sessionId, teamSeasonId, eventId, startsAtIso: '2026-10-08T15:00:00Z' };
const url = new URL(trainingPlanManagerHref(input), 'https://spielzeitapp.at');
assert.equal(url.pathname, `/manager/training/einheiten/${sessionId}`);
assert.equal(url.searchParams.get('view'), null, 'Open plan overview with replacement action, not automatic exercise overlay');
assert.equal(url.searchParams.get('returnTo'), `/app/events/${eventId}`);
for (const role of ['trainer', 'co_trainer', 'head_coach']) {
  assert.equal(resolveTrainingTrainerEntry(url.pathname, url.search, [{ team_season_id: teamSeasonId, role }]), teamSeasonId);
}
for (const role of ['parent', 'fan', 'player', 'admin']) {
  assert.equal(resolveTrainingTrainerEntry(url.pathname, url.search, [{ team_season_id: teamSeasonId, role }]), null);
}
assert.equal(resolveTrainingTrainerEntry(url.pathname, url.search, [{ team_season_id: 'another-team', role: 'trainer' }]), null);
assert.equal(resolveTrainingTrainerEntry('/manager/plattform', url.search, [{ team_season_id: teamSeasonId, role: 'trainer' }]), null);
assert.equal(resolveTrainingTrainerEntry(url.pathname, '', [{ team_season_id: teamSeasonId, role: 'trainer' }]), null);
for (const path of ['/manager/saisons/verwaltung', '/manager/saisons/meisterschaft']) {
  assert.equal(resolveTrainingTrainerEntry(path, url.search, [{ team_season_id: teamSeasonId, role: 'trainer' }]), teamSeasonId);
  assert.equal(resolveTrainingTrainerEntry(path, url.search, [{ team_season_id: teamSeasonId, role: 'parent' }]), null);
  assert.equal(resolveTrainingTrainerEntry(path, url.search, [{ team_season_id: 'other', role: 'trainer' }]), null);
}
const newUrl = new URL(trainingPlanManagerHref({ ...input, sessionId: null }), url.origin);
assert.equal(newUrl.pathname, '/manager/training/einheiten/neu');
assert.equal(newUrl.searchParams.get('event'), eventId);
assert.equal(newUrl.searchParams.get('starts'), input.startsAtIso);
const guard = readFileSync('src/manager/ManagerRouteGuard.tsx', 'utf8');
assert.ok(guard.indexOf('if (entryPending)') < guard.indexOf('return <Navigate to="/manager/plattform"'));
const editor = readFileSync('src/manager/ManagerTrainingSessionEditorPage.tsx', 'utf8');
assert.ok(editor.includes("'Plan wechseln'"));
console.log('PASS: exact plan, plan replacement overview, team context, return link, new plan and unauthorized entry rejected');
