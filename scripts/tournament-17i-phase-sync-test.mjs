/**
 * STEP 17I phase-sync — awaiting_next_round gates (no DB).
 * Run: node scripts/tournament-17i-phase-sync-test.mjs
 */

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok  ${msg}`);
  else {
    failed += 1;
    console.error(`fail ${msg}`);
  }
}

function safeOptionalText(v) {
  const t = String(v ?? '').trim();
  return t || null;
}

function safeText(v) {
  return String(v ?? '').trim();
}

function isOwnPlayableTournamentSlot(slot) {
  if (slot.is_own_team === false) return false;
  return Boolean(safeText(slot.match_id));
}

function normalizeSlotPhase(phase) {
  const raw = String(phase ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!raw) return 'group';
  if (raw.includes('final') && !raw.includes('semi') && !raw.includes('halb')) return 'final';
  if (raw.includes('semi') || raw.includes('halb')) return 'semi';
  if (raw.includes('platz') || raw.includes('third') || raw.includes('place_3') || raw.includes('3rd') || raw.includes('bronze')) {
    return 'placement';
  }
  if (raw.includes('ko') || raw.includes('knock') || raw.includes('viertel') || raw.includes('quarter')) return 'knockout';
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

function looksLikeUnresolvedTournamentTeamName(name) {
  const t = safeOptionalText(name);
  if (!t) return true;
  const n = t.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(tbd|n\/?a|\?+|-+|–+|—+|null|undefined)$/i.test(n)) return true;
  if (/gewinner|sieger|verlierer|loser|winner|runner.?up|qualifiant|qualifier|bye\b/i.test(n)) return true;
  if (/^(1|2|3|4)\.\s*(gruppe|group|platz|place)\b/i.test(n)) return true;
  if (/^(gruppe|group)\s*[a-d0-9]+\b/i.test(n) && /platz|place|sieger|gewinner|1\.|2\./i.test(n)) return true;
  if (/^(hf|vf|af|sf|f)\s*\d*$/i.test(n)) return true;
  if (/^(spiel|match)\s*(um\s*)?platz\s*\d+/i.test(n)) return true;
  return false;
}

function slotLooksUnresolvedPairing(slot) {
  if (looksLikeUnresolvedTournamentTeamName(slot.home_team)) return true;
  if (looksLikeUnresolvedTournamentTeamName(slot.away_team)) return true;
  if (!safeOptionalText(slot.home_team) && !safeOptionalText(slot.away_team)) {
    if (looksLikeUnresolvedTournamentTeamName(slot.opponent_name)) return true;
  }
  return false;
}

function isAwaitingFurtherTournamentPhase({ ownSlots, allSlots }) {
  if (ownSlots.length === 0) return false;
  if (!ownSlots.every((slot) => slotIsFinished(slot))) return false;

  const ownOnlyGroup = ownSlots.every((slot) => !isKnockoutLikePhase(slot.phase));
  const knockoutSlots = allSlots.filter((slot) => isKnockoutLikePhase(slot.phase));
  const planHasAnyKnockout = knockoutSlots.length > 0;

  const openCouldInvolveUs = (slot) => {
    if (slotIsFinished(slot)) return false;
    if (slot.is_own_team === true || isOwnPlayableTournamentSlot(slot)) return true;
    if (slotLooksUnresolvedPairing(slot)) return true;
    return false;
  };

  if (knockoutSlots.some((slot) => openCouldInvolveUs(slot))) return true;
  if (ownOnlyGroup && !planHasAnyKnockout) return true;

  if (ownOnlyGroup) {
    const openUngrouped = allSlots.filter((slot) => {
      if (slotIsFinished(slot)) return false;
      if (isKnockoutLikePhase(slot.phase)) return false;
      if (safeOptionalText(slot.group_label)) return false;
      return openCouldInvolveUs(slot) || slotLooksUnresolvedPairing(slot);
    });
    if (openUngrouped.length > 0) return true;
  }

  return false;
}

function canComplete({ balanceCompleted, awaiting }) {
  return Boolean(balanceCompleted) && !awaiting;
}

const ownGroup = (n, finished) =>
  Array.from({ length: n }, (_, i) => ({
    id: `og${i}`,
    is_own_team: true,
    match_id: `m${i}`,
    phase: 'group',
    match_status: finished ? 'finished' : i < 3 ? 'finished' : 'upcoming',
    opponent_name: `Opp ${i}`,
  }));

// A) 3 finished + 1 open
{
  const own = ownGroup(4, false);
  assert(
    isAwaitingFurtherTournamentPhase({ ownSlots: own.filter((s) => s.match_id), allSlots: own }) === false,
    'A: group still open → not awaiting',
  );
}

// B) 4/4 finished, no KO published
{
  const own = ownGroup(4, true);
  assert(isAwaitingFurtherTournamentPhase({ ownSlots: own, allSlots: own }) === true, 'B: awaiting_next_round');
  assert(canComplete({ balanceCompleted: true, awaiting: true }) === false, 'B: no Turnier beendet');
}

// C) 4/4 + HF promoted
{
  const own = [
    ...ownGroup(4, true),
    {
      id: 'hf',
      is_own_team: true,
      match_id: 'mhf',
      phase: 'semifinal',
      match_status: 'upcoming',
      opponent_name: 'Hartberg',
      home_team: 'NSG Rohrbach/St. Veit',
      away_team: 'TSV Hartberg',
    },
  ];
  assert(
    isAwaitingFurtherTournamentPhase({ ownSlots: own, allSlots: own }) === false,
    'C: open own KO → not awaiting (next match)',
  );
}

// Provider has placeholder KO
{
  const own = ownGroup(4, true);
  const all = [
    ...own,
    {
      id: 'ko1',
      is_own_team: false,
      match_id: null,
      phase: 'semifinal',
      match_status: 'upcoming',
      home_team: '1. Gruppe A',
      away_team: '2. Gruppe B',
    },
  ];
  assert(
    isAwaitingFurtherTournamentPhase({ ownSlots: own, allSlots: all }) === true,
    'placeholder KO keeps awaiting',
  );
}

// Named foreign KO only → eliminated
{
  const own = ownGroup(4, true);
  const all = [
    ...own,
    {
      id: 'ko1',
      is_own_team: false,
      match_id: null,
      phase: 'semifinal',
      match_status: 'upcoming',
      home_team: 'Austria Wien',
      away_team: 'TSV Hartberg',
    },
  ];
  assert(
    isAwaitingFurtherTournamentPhase({ ownSlots: own, allSlots: all }) === false,
    'named foreign KO → can complete',
  );
}

// F) last own final finished, no further
{
  const own = [
    ...ownGroup(4, true),
    {
      id: 'f',
      is_own_team: true,
      match_id: 'mf',
      phase: 'final',
      match_status: 'finished',
      opponent_name: 'Finalgegner',
      home_team: 'NSG',
      away_team: 'Finalgegner',
    },
  ];
  assert(isAwaitingFurtherTournamentPhase({ ownSlots: own, allSlots: own }) === false, 'F: true end');
  assert(canComplete({ balanceCompleted: true, awaiting: false }) === true, 'F: complete allowed');
}

assert(looksLikeUnresolvedTournamentTeamName('Gewinner HF1') === true, 'placeholder name');
assert(looksLikeUnresolvedTournamentTeamName('TSV Hartberg') === false, 'real team name');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall 17i phase-sync checks passed');
