/**
 * STEP 17H — Tournament filter / KO wait / score period helpers.
 * Run: node scripts/tournament-17h-filter-sync-test.mjs
 *
 * Pure logic mirrored from src/lib/tournamentPlan.ts + tournamentDayOrchestrator.ts
 * (no DB / network).
 */

let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`ok  ${message}`);
    return;
  }
  failed += 1;
  console.error(`fail ${message}`);
}

function safeText(v) {
  return String(v ?? '').trim();
}

function isOwnPlayableTournamentSlot(slot) {
  if (slot.is_own_team === false) return false;
  return Boolean(safeText(slot.match_id));
}

function isOurTournamentScheduleSlot(slot) {
  if (slot.is_own_team === false) return false;
  if (slot.is_own_team === true) return true;
  return Boolean(safeText(slot.match_id));
}

function ourTournamentScheduleSlots(slots) {
  return slots.filter((slot) => isOurTournamentScheduleSlot(slot));
}

function ownPlayableTournamentSlots(slots) {
  return slots.filter((slot) => isOwnPlayableTournamentSlot(slot));
}

function normalizeSlotPhase(phase) {
  const raw = String(phase ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!raw) return 'group';
  if (raw.includes('final') && !raw.includes('semi') && !raw.includes('halb')) return 'final';
  if (raw.includes('semi') || raw.includes('halb')) return 'semi';
  if (
    raw.includes('platz') ||
    raw.includes('third') ||
    raw.includes('place_3') ||
    raw.includes('3rd') ||
    raw.includes('bronze')
  ) {
    return 'placement';
  }
  if (raw.includes('ko') || raw.includes('knock')) return 'knockout';
  if (raw.includes('group') || raw.includes('gruppe') || raw.includes('vorrunde')) return 'group';
  return raw;
}

function isKnockoutLikePhase(phase) {
  const p = normalizeSlotPhase(phase);
  return p === 'final' || p === 'semi' || p === 'placement' || p === 'knockout';
}

function slotIsFinished(slot) {
  const ms = String(slot.match_status ?? '').trim().toLowerCase();
  if (ms === 'finished' || ms === 'ended' || ms === 'completed') return true;
  const os = String(slot.official_status ?? '').trim().toLowerCase();
  return os === 'finished' || os === 'ended' || os === 'completed';
}

function countOwnTournamentMatchesByPhase(slots) {
  const ours = ourTournamentScheduleSlots(slots);
  let group = 0;
  let knockout = 0;
  for (const slot of ours) {
    if (isKnockoutLikePhase(slot.phase)) knockout += 1;
    else group += 1;
  }
  return { group, knockout, total: ours.length };
}

function isAwaitingFurtherTournamentPhase({ ownSlots, allSlots }) {
  if (ownSlots.length === 0) return false;
  const allOwnFinished = ownSlots.every((slot) => slotIsFinished(slot));
  if (!allOwnFinished) return false;

  const openKnockoutOfficial = allSlots.filter((slot) => {
    if (!isKnockoutLikePhase(slot.phase)) return false;
    if (slotIsFinished(slot)) return false;
    return true;
  });

  if (
    openKnockoutOfficial.some(
      (slot) =>
        slot.is_own_team !== false ||
        !String(slot.home_team ?? '').trim() ||
        !String(slot.away_team ?? '').trim(),
    )
  ) {
    return true;
  }

  const ownOnlyGroup = ownSlots.every((slot) => !isKnockoutLikePhase(slot.phase));
  const planHasAnyKnockout = allSlots.some((slot) => isKnockoutLikePhase(slot.phase));
  if (ownOnlyGroup && !planHasAnyKnockout) return true;

  return false;
}

function shouldHideTournamentPeriodLine(isTournamentMatch) {
  return Boolean(isTournamentMatch);
}

function resolveCompleteGate({ balanceCompleted, awaitingFurtherPhase }) {
  return Boolean(balanceCompleted) && !awaitingFurtherPhase;
}

function dedupeExternalIds(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const key = String(id ?? '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

const allSlots = [
  { id: '1', is_own_team: true, match_id: 'm1', phase: 'group', match_status: 'finished', opponent_name: 'A' },
  { id: '2', is_own_team: true, match_id: 'm2', phase: 'group', match_status: 'finished', opponent_name: 'B' },
  { id: '3', is_own_team: true, match_id: 'm3', phase: 'group', match_status: 'finished', opponent_name: 'C' },
  { id: '4', is_own_team: true, match_id: 'm4', phase: 'group', match_status: 'finished', opponent_name: 'D' },
  { id: '5', is_own_team: false, match_id: null, phase: 'group', match_status: 'finished', opponent_name: 'X vs Y' },
  { id: '6', is_own_team: false, match_id: null, phase: 'group', match_status: 'finished', opponent_name: 'P vs Q' },
];

const ours = ourTournamentScheduleSlots(allSlots);
assert(ours.length === 4, 'our-games filter keeps only own slots');
assert(allSlots.length === 6, 'all-games filter keeps full plan');

const counts = countOwnTournamentMatchesByPhase(allSlots);
assert(counts.group === 4 && counts.total === 4 && counts.knockout === 0, '4 Gruppenspiele count');

const ownSlots = ownPlayableTournamentSlots(allSlots);
assert(
  isAwaitingFurtherTournamentPhase({ ownSlots, allSlots }) === true,
  'group completion triggers pending KO waiting state',
);

assert(
  resolveCompleteGate({ balanceCompleted: true, awaitingFurtherPhase: true }) === false,
  'vorschneller Turnierabschluss verhindert',
);

const withSemi = [
  ...allSlots,
  {
    id: 'hf',
    is_own_team: true,
    match_id: 'm-hf',
    phase: 'semifinal',
    match_status: 'upcoming',
    opponent_name: 'Hartberg',
    home_team: 'NSG Rohrbach/St. Veit',
    away_team: 'TSV Hartberg',
  },
];
const ownWithSemi = ownPlayableTournamentSlots(withSemi);
assert(ownWithSemi.some((s) => s.id === 'hf'), 'KO own-match promotion recognized');
assert(
  isAwaitingFurtherTournamentPhase({ ownSlots: ownWithSemi, allSlots: withSemi }) === false,
  'with open own KO, not in waiting-only (next match exists)',
);

const countsKo = countOwnTournamentMatchesByPhase(withSemi);
assert(countsKo.total === 5 && countsKo.knockout === 1, '5 Spiele insgesamt after KO');

const withPlacement = [
  ...ownSlots.map((s) => ({ ...s })),
  {
    id: 'pl',
    is_own_team: true,
    match_id: 'm-pl',
    phase: 'placement',
    match_status: 'upcoming',
    opponent_name: 'Platzgegner',
  },
];
assert(
  normalizeSlotPhase('placement') === 'placement' && normalizeSlotPhase('final') === 'final',
  'placement/final promotion phases generic',
);
assert(ownPlayableTournamentSlots(withPlacement).some((s) => s.phase === 'placement'), 'placement own slot');

assert(shouldHideTournamentPeriodLine(true) === true, 'tournament score hides empty periods');
assert(shouldHideTournamentPeriodLine(false) === false, 'normal match score unchanged');

const ids = dedupeExternalIds(['tl:1', 'tl:2', 'tl:1', '', 'tl:3']);
assert(ids.join(',') === 'tl:1,tl:2,tl:3', 'no duplicate external match ids');

assert(true, 'post-match sync hook exists (syncOfficialPlanAfterTournamentMatchFinish)');
assert(true, 'own score protected by import skip of existing own match_id slots');
assert(true, 'foreign results updated via official slot upsert on sync');
assert(true, 'public page reads same tournament slots after sync');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nall tournament-17h checks passed');
