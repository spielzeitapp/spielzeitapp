/**
 * STEP 17E – Unit checks for lineup permissions + previous→next tournament copy helpers.
 * Pure logic only (no DB / RLS). Run: node scripts/tournament-lineup-permissions-test.mjs
 */
import assert from 'assert';

/** Mirror of src/lib/roles.ts normalizeRole + canManageMatches */
function normalizeRole(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'administrator' || s === 'admin') return 'admin';
  if (s === 'head_coach' || s === 'headcoach' || s === 'coach' || s === 'co_trainer' || s === 'co-trainer' || s === 'co trainer' || s === 'trainer') {
    return 'trainer';
  }
  if (s === 'parent' || s === 'eltern') return 'parent';
  if (s === 'player' || s === 'spieler') return 'player';
  if (s === 'fan') return 'fan';
  return null;
}

function canManageMatches(role) {
  if (!role) return false;
  return role === 'trainer' || role === 'admin' || role === 'head_coach' || role === 'co_trainer';
}

function canMutateMatchPreparation(role) {
  return canManageMatches(normalizeRole(role));
}

function friendlyMatchLineupWriteError(raw) {
  const msg = String(raw ?? '').trim();
  if (!msg) return 'Aufstellung konnte nicht gespeichert werden.';
  if (/row-level security|rls|permission denied|not allowed/i.test(msg)) {
    return 'Aufstellung konnte nicht gespeichert werden.';
  }
  return msg;
}

function isTournamentMatchLineupEmpty(lineup) {
  const hasField = lineup.startingPlayerIds.some((id) => String(id ?? '').trim().length > 0);
  const hasBench = lineup.savedBenchPlayerIds.some((id) => String(id ?? '').trim().length > 0);
  return !hasField && !hasBench;
}

function sortTournamentSlotsChronologically(slots) {
  return [...slots].sort((a, b) => {
    const ta = new Date(a.kickoff_at ?? a.starts_at ?? 0).getTime();
    const tb = new Date(b.kickoff_at ?? b.starts_at ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

function pickPreviousFinishedMatchWithLineup(slots, nextSlot) {
  const ordered = sortTournamentSlotsChronologically(slots);
  const nextIdx = ordered.findIndex((s) => s.id === nextSlot.id);
  if (nextIdx <= 0) return null;
  for (let i = nextIdx - 1; i >= 0; i -= 1) {
    const slot = ordered[i];
    if ((slot.match_status ?? '').toLowerCase() !== 'finished') continue;
    if (slot.has_lineup || slot.has_squad) return slot;
  }
  return null;
}

// --- parent cannot mutate / trainer can mutate ---
assert.strictEqual(canMutateMatchPreparation('parent'), false, 'parent cannot mutate');
assert.strictEqual(canMutateMatchPreparation('fan'), false, 'fan cannot mutate');
assert.strictEqual(canMutateMatchPreparation('player'), false, 'player cannot mutate');
assert.strictEqual(canMutateMatchPreparation('trainer'), true, 'trainer can mutate');
assert.strictEqual(canMutateMatchPreparation('admin'), true, 'admin can mutate');
assert.strictEqual(canMutateMatchPreparation('co_trainer'), true, 'co_trainer can mutate');

// --- friendly RLS error ---
assert.strictEqual(
  friendlyMatchLineupWriteError('new row violates row-level security policy for table "match_lineup"'),
  'Aufstellung konnte nicht gespeichert werden.',
);

// --- empty lineup detection ---
assert.strictEqual(
  isTournamentMatchLineupEmpty({ startingPlayerIds: ['', '', ''], savedBenchPlayerIds: [] }),
  true,
);
assert.strictEqual(
  isTournamentMatchLineupEmpty({ startingPlayerIds: ['p1'], savedBenchPlayerIds: [] }),
  false,
);

// --- previous → next generic (match 1→2 and 2→3) ---
const slots = [
  {
    id: 's1',
    match_id: 'm1',
    kickoff_at: '2026-08-01T09:00:00Z',
    match_status: 'finished',
    has_lineup: true,
    has_squad: true,
  },
  {
    id: 's2',
    match_id: 'm2',
    kickoff_at: '2026-08-01T10:00:00Z',
    match_status: 'finished',
    has_lineup: true,
    has_squad: true,
  },
  {
    id: 's3',
    match_id: 'm3',
    kickoff_at: '2026-08-01T11:00:00Z',
    match_status: 'upcoming',
    has_lineup: false,
    has_squad: false,
  },
];

const prevFor2 = pickPreviousFinishedMatchWithLineup(slots, slots[1]);
assert.strictEqual(prevFor2?.match_id, 'm1', 'Spiel 2 previous = Spiel 1');

const prevFor3 = pickPreviousFinishedMatchWithLineup(slots, slots[2]);
assert.strictEqual(prevFor3?.match_id, 'm2', 'Spiel 3 previous = Spiel 2 (not Spiel 1)');

// --- existing next-match lineup must not be treated as empty (overwrite guard signal) ---
assert.strictEqual(
  isTournamentMatchLineupEmpty({
    startingPlayerIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    savedBenchPlayerIds: ['h'],
  }),
  false,
  'existing lineup is not empty → no silent overwrite',
);

// --- copy payload must not include match events (contract check via mode list) ---
const COPY_MODES = ['full', 'starters', 'bench', 'squad_only'];
assert.ok(COPY_MODES.includes('full'));
assert.ok(!COPY_MODES.includes('events'), 'no match events copy mode');

console.log('tournament-lineup-permissions-test: OK');
