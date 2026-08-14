/**
 * STEP 17E/17F – Unit checks for lineup permissions + previous→next tournament copy helpers.
 * Pure logic only (no DB / RLS). Run: node scripts/tournament-lineup-permissions-test.mjs
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

/** Mirrors STARTELF_SLOT_IDS length (7) — FP is ignored. */
function isStartelfCompleteFromStartingIds(startingPlayerIds) {
  const STARTELF_COUNT = 7;
  let filled = 0;
  for (let i = 0; i < STARTELF_COUNT; i++) {
    if (String(startingPlayerIds[i] ?? '').trim().length > 0) filled++;
  }
  return filled >= STARTELF_COUNT;
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
    if (slot.has_lineup) return slot;
  }
  for (let i = nextIdx - 1; i >= 0; i -= 1) {
    const slot = ordered[i];
    if ((slot.match_status ?? '').toLowerCase() !== 'finished') continue;
    if (slot.has_squad) return slot;
  }
  return null;
}

assert.strictEqual(canMutateMatchPreparation('parent'), false);
assert.strictEqual(canMutateMatchPreparation('trainer'), true);

assert.strictEqual(
  friendlyMatchLineupWriteError('new row violates row-level security policy for table "match_lineup"'),
  'Aufstellung konnte nicht gespeichert werden.',
);

assert.strictEqual(
  isStartelfCompleteFromStartingIds(['a', 'b', 'c', 'd', 'e', 'f', 'g', '']),
  true,
  '7er complete without FP',
);
assert.strictEqual(
  isStartelfCompleteFromStartingIds(['a', 'b', 'c', 'd', 'e', 'f', '', '']),
  false,
);

assert.strictEqual(
  isTournamentMatchLineupEmpty({ startingPlayerIds: ['', ''], savedBenchPlayerIds: [] }),
  true,
);

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

assert.strictEqual(pickPreviousFinishedMatchWithLineup(slots, slots[1])?.match_id, 'm1');
assert.strictEqual(pickPreviousFinishedMatchWithLineup(slots, slots[2])?.match_id, 'm2');

console.log('tournament-lineup-permissions-test: OK');
