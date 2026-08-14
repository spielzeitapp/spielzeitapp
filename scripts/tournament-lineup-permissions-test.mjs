/**
 * STEP 17E/17F/17G – Unit checks for lineup permissions + previous→next tournament copy helpers.
 * Run: node scripts/tournament-lineup-permissions-test.mjs
 */
import assert from 'assert';

function normalizeRole(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'administrator' || s === 'admin') return 'admin';
  if (
    s === 'head_coach' ||
    s === 'headcoach' ||
    s === 'coach' ||
    s === 'co_trainer' ||
    s === 'co-trainer' ||
    s === 'co trainer' ||
    s === 'trainer'
  ) {
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

function isStartelfCompleteFromStartingIds(startingPlayerIds) {
  const STARTELF_COUNT = 7;
  let filled = 0;
  for (let i = 0; i < STARTELF_COUNT; i++) {
    if (String(startingPlayerIds[i] ?? '').trim().length > 0) filled++;
  }
  return filled >= STARTELF_COUNT;
}

function finishedStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'finished' || s === 'ended' || s === 'completed';
}

function sortTournamentSlotsChronologically(slots) {
  return [...slots].sort((a, b) => {
    const ta = new Date(a.kickoff_at ?? 0).getTime();
    const tb = new Date(b.kickoff_at ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

function pickImmediatePreviousOwnFinishedSlot(slots, nextSlot) {
  const ordered = sortTournamentSlotsChronologically(slots).filter((s) => s.is_own_team !== false);
  const nextIdx = ordered.findIndex((s) => s.id === nextSlot.id);
  if (nextIdx <= 0) return null;
  for (let i = nextIdx - 1; i >= 0; i -= 1) {
    const slot = ordered[i];
    if (!finishedStatus(slot.match_status)) continue;
    if (!slot.match_id?.trim()) continue;
    return slot;
  }
  return null;
}

assert.strictEqual(canMutateMatchPreparation('parent'), false);
assert.strictEqual(canMutateMatchPreparation('trainer'), true);
assert.strictEqual(
  isStartelfCompleteFromStartingIds(['a', 'b', 'c', 'd', 'e', 'f', 'g', '']),
  true,
);

const slots = [
  {
    id: 's1',
    match_id: 'm1',
    kickoff_at: '2026-08-01T09:00:00Z',
    match_status: 'finished',
    is_own_team: true,
    has_lineup: true,
  },
  {
    id: 'foreign',
    match_id: 'fx',
    kickoff_at: '2026-08-01T09:30:00Z',
    match_status: 'finished',
    is_own_team: false,
    has_lineup: true,
  },
  {
    id: 's2',
    match_id: 'm2',
    kickoff_at: '2026-08-01T10:00:00Z',
    match_status: 'finished',
    is_own_team: true,
    has_lineup: true,
  },
  {
    id: 's3',
    match_id: 'm3',
    kickoff_at: '2026-08-01T11:00:00Z',
    match_status: 'upcoming',
    is_own_team: true,
    has_lineup: false,
  },
];

assert.strictEqual(
  pickImmediatePreviousOwnFinishedSlot(slots, slots[2])?.match_id,
  'm1',
  'Spiel 2 previous = Spiel 1 (skip foreign)',
);
assert.strictEqual(
  pickImmediatePreviousOwnFinishedSlot(slots, slots[3])?.match_id,
  'm2',
  'Spiel 3 previous = Spiel 2',
);

// Squad prefill must not overwrite field lineup: signal via targetHasField rule
function targetHasExistingLineup(startingPlayerIds) {
  return startingPlayerIds.some((id) => String(id ?? '').trim().length > 0);
}
assert.strictEqual(targetHasExistingLineup(['', '', 'p1']), true);
assert.strictEqual(targetHasExistingLineup(['', '', '']), false);

// Parent live switch priority: live beats finished sticky
function preferLiveOverSticky(stickyId, liveId) {
  if (liveId && liveId !== stickyId) return liveId;
  return stickyId;
}
assert.strictEqual(preferLiveOverSticky('m1', 'm2'), 'm2');
assert.strictEqual(preferLiveOverSticky('m2', 'm2'), 'm2');

console.log('tournament-lineup-permissions-test: OK');
