import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { filterLinkedReminderUsers, isEligibleForReminder, isInjuredForReminder } from '../supabase/functions/send-reminders/recipientEligibility.ts';

const start = '2026-10-06T16:00:00Z';
const injured = { is_injured: true, injured_since: '2026-10-01T00:00:00Z', injured_until: null };
for (const kind of ['training', 'match']) {
  assert.equal(isEligibleForReminder(kind, undefined, injured, start), false);
  assert.equal(isEligibleForReminder(kind, 'yes', injured, start), false);
  assert.equal(isEligibleForReminder(kind, undefined, { is_injured: false }, start), true);
  for (const status of ['no', 'sick', 'injured', 'external_training']) {
    assert.equal(isEligibleForReminder(kind, status, {}, start), false);
  }
}
assert.equal(isEligibleForReminder('training', 'yes', {}, start), true);
assert.equal(isEligibleForReminder('match', 'yes', {}, start), false);
assert.equal(isInjuredForReminder(injured, '2026-09-30T16:00:00Z'), false);
assert.equal(isInjuredForReminder({ ...injured, injured_until: '2026-10-05T23:59:59Z' }, start), false);
assert.equal(isInjuredForReminder({ ...injured, injured_until: start }, start), true);
assert.equal(isInjuredForReminder(injured, null), true);
const links = new Map([['parent', new Set(['injured', 'healthy'])], ['player', new Set(['injured'])]]);
assert.deepEqual(filterLinkedReminderUsers(['parent', 'player', 'staff'], links, new Set(['healthy']), true), ['parent', 'staff']);
assert.deepEqual(filterLinkedReminderUsers(['parent', 'player', 'staff'], links, new Set(['healthy']), false), ['parent']);

// Exercise the production query/mapping function without calling Supabase or sending messages.
const source = readFileSync(new URL('../supabase/functions/send-reminders/index.ts', import.meta.url), 'utf8');
const fnSource = source.slice(source.indexOf('async function filterParticipationReminderRecipients('), source.indexOf('\nfunction buildReminderUxCopy('));
const fn = new Function('filterLinkedReminderUsers', 'isEligibleForReminder', stripTypeScriptTypes(fnSource) + '\nreturn filterParticipationReminderRecipients;')(filterLinkedReminderUsers, isEligibleForReminder);
const rows = {
  event_attendance: [{ player_id: 'external', status: 'external_training' }],
  team_season_players: ['injured', 'healthy', 'external'].map(player_id => ({ player_id })),
  players: [{ id: 'injured', ...injured }, { id: 'healthy', is_injured: false }, { id: 'external', is_injured: false }],
  player_guardians: [{ user_id: 'parent', player_id: 'injured' }, { user_id: 'parent', player_id: 'healthy' }, { user_id: 'external-parent', player_id: 'external' }],
  player_users: [{ user_id: 'player', player_id: 'injured' }],
};
const mock = (failure) => ({ from(table) {
  const query = { select() { return this; }, eq() { return this; }, is() { return this; }, in() { return this; },
    then(resolve) { return Promise.resolve({ data: rows[table], error: table === failure ? new Error('query failed') : null }).then(resolve); } };
  return query;
} });
const event = { id: 'event', team_season_id: 'season', starts_at: start };
const users = ['parent', 'player', 'external-parent', 'staff'];
assert.deepEqual(await fn(mock(), event, users, 'training'), ['parent', 'staff']);
assert.deepEqual(await fn(mock(), event, users, 'match'), ['parent']);
rows.players[0].is_injured = false;
assert.deepEqual(await fn(mock(), event, users, 'training'), ['parent', 'player', 'staff']);
assert.deepEqual(await fn(mock(), event, users, 'match'), ['parent', 'player']);
for (const table of Object.keys(rows)) await assert.rejects(fn(mock(table), event, users, 'training'), /query failed/);
assert.deepEqual(await fn(mock(), event, [], 'training'), []);
assert.match(source, /\(jobKind === "match" \|\| jobKind === "training"\) && !isMatchday && !isCarpool && !isSquad/);
assert.ok(source.indexOf('if (uniqueUserIds.length === 0)', source.indexOf('const targetedRecipients')) < source.indexOf('const notifRows'));
console.log('PASS: injury periods, recovery, RSVP statuses, siblings, staff, database errors, and dispatch integration');
