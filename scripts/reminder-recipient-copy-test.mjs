import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadTs(path) {
  const context = { exports: {} };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}
const { collectReminderChildNames, personalizeReminderCopy } = loadTs('supabase/functions/send-reminders/recipientCopy.ts');
const { isEligibleForReminder, filterLinkedReminderUsers } = loadTs('supabase/functions/send-reminders/recipientEligibility.ts');
const members = [
  { user_id: 'parent', role: 'parent' }, { user_id: 'sibling-parent', role: 'parent' },
  { user_id: 'player', role: 'player' }, { user_id: 'coach', role: 'trainer' },
  { user_id: 'coach', role: 'parent' },
];
const guardians = [
  { user_id: 'parent', player_id: 'daniel' }, { user_id: 'parent', player_id: 'daniel' },
  { user_id: 'parent', player_id: 'other-team' },
  { user_id: 'sibling-parent', player_id: 'daniel' }, { user_id: 'sibling-parent', player_id: 'anna' },
  { user_id: 'coach', player_id: 'daniel' },
];
const players = [{ id: 'daniel', first_name: ' Daniel ', last_name: 'Beispiel' }, { id: 'anna', first_name: 'Anna' }];
let names = collectReminderChildNames(members, guardians, players);
assert.equal(JSON.stringify(names.get('parent')), '["Daniel"]');
assert.equal(JSON.stringify(names.get('sibling-parent')), '["Anna","Daniel"]');
assert.equal(names.has('player'), false);
assert.equal(names.has('coach'), false);
const training = { title: 'Training', message: 'Heute um 17:15 Uhr. Ort: Sportplatz St. Veit. Du bist eingeplant – falls du nicht kommen kannst, bitte absagen.' };
assert.equal(personalizeReminderCopy('training', training, names.get('parent')).message,
  'Heute um 17:15 Uhr. Ort: Sportplatz St. Veit. Daniel ist eingeplant – falls Daniel nicht kommen kann, bitte absagen.');
assert.equal(personalizeReminderCopy('training', training, names.get('player')), training);
assert.match(personalizeReminderCopy('training', training, names.get('sibling-parent')).message, /Anna und Daniel sind eingeplant/);
for (const kind of ['training', 'match']) {
  for (const status of ['no', 'sick', 'injured', 'external_training']) assert.equal(isEligibleForReminder(kind, status, {}, '2026-10-15T15:30:00Z'), false);
  assert.equal(isEligibleForReminder(kind, null, { is_injured: true }, '2026-10-15T15:30:00Z'), false);
}
assert.equal(isEligibleForReminder('training', 'yes', {}, '2026-10-15T15:30:00Z'), true);
assert.equal(isEligibleForReminder('match', 'yes', {}, '2026-10-15T15:30:00Z'), false);
names = collectReminderChildNames(members, guardians, players.filter(p => p.id === 'anna'));
assert.equal(names.has('parent'), false);
assert.equal(JSON.stringify(names.get('sibling-parent')), '["Anna"]');
const first = { title: '⚽ Spiel gegen Beispiel', message: 'Bitte für das Spiel am 17.10. um 10:00 Uhr zu- oder absagen.' };
assert.equal(personalizeReminderCopy('match', first, ['Daniel']).message,
  'Spiel am 17.10. um 10:00 Uhr: Bitte für Daniel zu- oder absagen.');
assert.equal(personalizeReminderCopy('match', { ...first, message: 'Deine Rückmeldung fehlt noch. Bitte jetzt verbindlich zu- oder absagen.' }, ['Daniel']).message,
  'Die Rückmeldung für Daniel fehlt noch. Bitte jetzt verbindlich zu- oder absagen.');
assert.equal(personalizeReminderCopy('event', { title: 'Termin', message: '17.10. 10:00 – Treffpunkt nicht vergessen' }, ['Daniel']).message,
  '17.10. 10:00 – Treffpunkt für Daniel nicht vergessen');
const linked = new Map([['parent', new Set(['daniel'])], ['sibling-parent', new Set(['daniel', 'anna'])]]);
assert.equal(JSON.stringify(filterLinkedReminderUsers(['parent', 'sibling-parent'], linked, new Set(['anna']), false)), '["sibling-parent"]');

// Exercise the actual Edge Function audience loader using a read-only database mock.
const edge = fs.readFileSync('supabase/functions/send-reminders/index.ts', 'utf8');
const functionText = edge.slice(edge.indexOf('async function filterParticipationReminderRecipients('), edge.indexOf('\nfunction buildReminderUxCopy('));
const context = { collectReminderChildNames, isEligibleForReminder, filterLinkedReminderUsers };
vm.createContext(context);
vm.runInContext(ts.transpileModule(functionText, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const database = {
  event_attendance: [{ player_id: 'daniel', status: 'external_training' }],
  team_season_players: [{ player_id: 'daniel' }, { player_id: 'anna' }],
  players, player_guardians: guardians, player_users: [{ user_id: 'player', player_id: 'daniel' }],
};
const client = { from(table) {
  const query = { select() { return query; }, eq() { return query; }, is() { return query; },
    in() { return query; }, then(resolve, reject) { return Promise.resolve({ data: database[table], error: null }).then(resolve, reject); } };
  return query;
} };
const audience = await context.filterParticipationReminderRecipients(client,
  { id: 'event', team_season_id: 'season', starts_at: '2026-10-15T15:30:00Z' },
  ['parent', 'sibling-parent', 'player', 'coach'], 'training', members);
assert.equal(JSON.stringify(audience.userIds), '["sibling-parent"]');
assert.equal(JSON.stringify(audience.childNamesByUser.get('sibling-parent')), '["Anna"]');
assert.equal(audience.childNamesByUser.has('parent'), false);
assert.equal(audience.childNamesByUser.has('coach'), false);
console.log('Reminder personalization: parent/player/staff, multiple children, eligibility, training/match/event and Edge audience checks passed.');

// Verify per-user push payloads use exactly the inbox copy and never another family's names.
const pushes = [];
const pushContext = {
  console: { log() {}, warn() {}, error() {} },
  normalizePushAppUrl: value => value, ensureVapid: () => true, endpointPrefix: value => value,
  buildTeamAlignedPushPayload: (title, body) => JSON.stringify({ title, body }),
  webpush: { async sendNotification(subscription, payload) { pushes.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) }); } },
};
vm.createContext(pushContext);
vm.runInContext(ts.transpileModule(edge.slice(edge.indexOf('async function sendReminderWebPushes('), edge.indexOf('\nfunction formatTimeDe(')),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, pushContext);
const subscriptions = ['parent', 'player'].map(user_id => ({ user_id, endpoint: user_id, p256dh: 'mock', auth: 'mock' }));
const pushClient = { from(table) {
  const query = { select() { return query; }, in() { return query; }, not() { return query; }, eq() { return query; }, upsert() { return query; },
    then(resolve, reject) { return Promise.resolve({ data: table === 'push_subscriptions' ? subscriptions : [], count: 1, error: null }).then(resolve, reject); } };
  return query;
} };
const parentCopy = personalizeReminderCopy('training', training, ['Daniel']);
await pushContext.sendReminderWebPushes(pushClient, ['parent', 'player'], training.title, training.message, '/app/events/mock', 'mock-job', 'mock-event',
  new Map([['parent', parentCopy], ['player', training]]));
assert.equal(pushes.length, 2);
assert.equal(pushes.find(p => p.endpoint === 'parent').body, parentCopy.message);
assert.equal(pushes.find(p => p.endpoint === 'player').body, training.message);
console.log('Per-user push/inbox consistency checks passed (mock only; no real notifications sent).');
