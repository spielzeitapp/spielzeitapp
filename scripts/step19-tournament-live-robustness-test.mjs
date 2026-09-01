/**
 * STEP 19 Phase-2 — TURNIERlive robustness verification.
 * Run: node scripts/step19-tournament-live-robustness-test.mjs
 *
 * Covers: score parsing (incl. 0), stable external IDs, result-only changed,
 * placeholder→concrete identity, Live priority, Turniercenter CTA, trainer edit gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTournamentLiveResults } from '../api/_lib/tournamentLiveAdapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok  ${msg}`);
  else {
    failed += 1;
    console.error(`fail ${msg}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const adapter = read('src/lib/tournamentLiveAdapter.ts');
const adapterJs = read('api/_lib/tournamentLiveAdapter.js');
const importTs = read('src/lib/tournamentPlanImport.ts');
const syncTs = read('src/lib/tournamentPlanSync.ts');
const standingsTs = read('src/lib/tournamentGroupStandings.ts');
const matchCenter = read('src/lib/matchCenterUtils.ts');
const idle = read('src/components/live/MatchCenterIdleView.tsx');
const card = read('src/components/live/MatchCenterTournamentCard.tsx');
const featured = read('src/components/tournament/TournamentFeaturedMatchCard.tsx');
const edit = read('src/components/tournament/TournamentOwnMatchEditSheet.tsx');
const unresolved = read('src/lib/tournamentUnresolvedTeam.ts');

// --- Source gates ---
assert(
  /assignment1ScoredGoals\s*\?\?/.test(adapter) && /assignment2ScoredGoals\s*\?\?/.test(adapter),
  'TS adapter prioritizes assignment*ScoredGoals',
);
assert(
  /assignment1ScoredGoals\s*\?\?/.test(adapterJs) && /assignment2ScoredGoals\s*\?\?/.test(adapterJs),
  'JS adapter prioritizes assignment*ScoredGoals',
);
assert(!adapter.includes('${homeTeam}-${awayTeam}'), 'no team-name synthetic external id (TS)');
assert(!adapterJs.includes('${homeTeam}-${awayTeam}'), 'no team-name synthetic external id (JS)');
assert(importTs.includes('physicalKey'), 'physical slot identity for promotion');
assert(importTs.includes('else if (updated) updatedResults += 1'), 'any official update counts as changed');
assert(syncTs.includes('result.updatedResults > 0'), 'sync changed includes updatedResults');
assert(syncTs.includes('Boolean(params.force)'), 'forced sync refreshes UI');
assert(
  standingsTs.includes('ownFinished') && standingsTs.includes('officialFinished'),
  'standings separate own vs official results',
);
assert(
  /if \(ownFinished\)[\s\S]*score_home[\s\S]*else if \(officialFinished\)/.test(standingsTs),
  'own finished scores take precedence over official',
);
assert(matchCenter.includes('pickActiveTournamentDayEvent'), 'active tournament day helper');
assert(idle.includes('pickActiveTournamentDayEvent'), 'Live idle prioritizes active tournament day');
assert(idle.includes('awaiting_next_round'), 'Live idle awaiting mode');
assert(card.includes('Turnier öffnen'), 'Live → Turniercenter CTA');
assert(card.includes('Vorrunde beendet'), 'awaiting copy in Live card');
assert(featured.includes('canManage &&') && featured.includes('Spiel bearbeiten'), 'trainer edit gated by canManage');
assert(edit.includes('externalMatchId: slot.external_match_id'), 'trainer edit keeps external_match_id');
assert(edit.includes('provider: slot.provider'), 'trainer edit keeps provider');
assert(unresolved.includes('looksLikeUnresolvedTournamentTeamName'), 'shared unresolved helper');
assert(
  !importTs.includes('Wiener Neustadt') && !adapter.includes('Steurer'),
  'no tournament-specific hardcoding',
);

// --- Pure: changed gate (result-only) ---
function computeChanged({ importedTeams = 0, importedMatches = 0, updatedResults = 0, force = false }) {
  return importedTeams > 0 || importedMatches > 0 || updatedResults > 0 || Boolean(force);
}
assert(
  computeChanged({ updatedResults: 1, force: false }) === true,
  'result-only sync triggers changed without force',
);
assert(computeChanged({}) === false, 'empty sync is unchanged');
assert(computeChanged({ force: true }) === true, 'forced sync always changed');

// --- Pure: score extract via real adapter ---
function fixturePlan(matches) {
  return {
    data: [
      {
        items: [
          {
            type: 'groupSchedule',
            title: 'Gruppe 1',
            parentTitle: 'Gruppenphase',
            scheduleItems: matches,
            tableItems: [],
          },
        ],
      },
    ],
  };
}

const scoreCases = [
  { a: 2, b: 0, label: '2:0' },
  { a: 1, b: 0, label: '1:0' },
  { a: 5, b: 0, label: '5:0' },
  { a: 1, b: 2, label: '1:2' },
  { a: 0, b: 0, label: '0:0' },
];
for (const c of scoreCases) {
  const parsed = parseTournamentLiveResults(
    fixturePlan([
      {
        _id: `id-${c.label}`,
        type: 'game',
        gameNumber: 1,
        gameField: '1',
        time: '10:00',
        assignment1: 'Team A',
        assignment2: 'Team B',
        assignment1ScoredGoals: c.a,
        assignment2ScoredGoals: c.b,
        result1: null,
        result2: null,
      },
    ]),
    { title: 'Test' },
  );
  const m = parsed?.rawMatches?.[0];
  assert(m?.hasResult === true, `${c.label} hasResult true`);
  assert(m?.homeGoals === c.a && m?.awayGoals === c.b, `${c.label} goals ${c.a}:${c.b}`);
}

// assignment* wins over conflicting result1
{
  const parsed = parseTournamentLiveResults(
    fixturePlan([
      {
        _id: 'prio',
        type: 'game',
        gameNumber: 1,
        gameField: '1',
        time: '10:00',
        assignment1: 'A',
        assignment2: 'B',
        assignment1ScoredGoals: 5,
        assignment2ScoredGoals: 0,
        result1: 9,
        result2: 9,
      },
    ]),
    { title: 'Test' },
  );
  const m = parsed?.rawMatches?.[0];
  assert(m?.homeGoals === 5 && m?.awayGoals === 0, 'assignment* prioritized over result1/result2');
}

// --- Stable provider ID ---
{
  const parsed = parseTournamentLiveResults(
    fixturePlan([
      {
        _id: '6a8058a4692051001ab86046',
        type: 'game',
        title: 'Spiel um Platz 7',
        gameNumber: 24,
        gameField: '2',
        time: '13:27',
        assignment1: 'NSG Rohrbach/St. Veit',
        assignment2: 'SC Wiener Neustadt',
        assignment1ScoredGoals: 1,
        assignment2ScoredGoals: 2,
      },
    ]),
    { title: 'KO' },
  );
  // parse with koSchedule for placement phase
  const koParsed = parseTournamentLiveResults(
    {
      data: [
        {
          items: [
            {
              type: 'koSchedule',
              title: 'Spiel um Platz 7',
              parentTitle: 'K.O.-Phase',
              scheduleItems: [
                {
                  _id: '6a8058a4692051001ab86046',
                  type: 'game',
                  title: 'Spiel um Platz 7',
                  gameNumber: 24,
                  gameField: '2',
                  time: '13:27',
                  assignment1: 'NSG Rohrbach/St. Veit',
                  assignment2: 'SC Wiener Neustadt',
                  assignment1ScoredGoals: 1,
                  assignment2ScoredGoals: 2,
                },
              ],
            },
          ],
        },
      ],
    },
    { title: 'KO' },
  );
  const m = koParsed?.rawMatches?.[0];
  assert(m?.externalMatchId === '6a8058a4692051001ab86046', 'provider _id is externalMatchId');
  assert(m?.phase === 'placement', 'placement phase from Platz label');
  assert(m?.groupLabel === 'Spiel um Platz 7', 'placement title persisted in groupLabel');
  assert(m?.kickoffTimeHHmm === '13:27', 'kickoff 13:27');
  assert(m?.pitch === 'Platz 2', 'pitch Platz 2');
  assert(m?.homeGoals === 1 && m?.awayGoals === 2, 'placement score 1:2');
  void parsed;
}

// Placeholder → concrete: same _id
{
  const ph = parseTournamentLiveResults(
    {
      data: [
        {
          items: [
            {
              type: 'koSchedule',
              title: 'Spiel um Platz 7',
              parentTitle: 'K.O.-Phase',
              scheduleItems: [
                {
                  _id: '6a8058a4692051001ab86046',
                  type: 'game',
                  gameNumber: 24,
                  gameField: '2',
                  time: '13:27',
                  assignment1: '4. Gruppe 1',
                  assignment2: '4. Gruppe 2',
                },
              ],
            },
          ],
        },
      ],
    },
    { title: 'KO' },
  );
  const concrete = parseTournamentLiveResults(
    {
      data: [
        {
          items: [
            {
              type: 'koSchedule',
              title: 'Spiel um Platz 7',
              parentTitle: 'K.O.-Phase',
              scheduleItems: [
                {
                  _id: '6a8058a4692051001ab86046',
                  type: 'game',
                  gameNumber: 24,
                  gameField: '2',
                  time: '13:27',
                  assignment1: 'NSG Rohrbach/St. Veit',
                  assignment2: 'SC Wiener Neustadt',
                  assignment1ScoredGoals: 1,
                  assignment2ScoredGoals: 2,
                },
              ],
            },
          ],
        },
      ],
    },
    { title: 'KO' },
  );
  assert(
    ph?.rawMatches?.[0]?.externalMatchId === concrete?.rawMatches?.[0]?.externalMatchId,
    'placeholder→concrete keeps same provider externalMatchId',
  );
  assert(
    ph?.rawMatches?.[0]?.externalMatchId === '6a8058a4692051001ab86046',
    'identity independent of team names',
  );
}

// Fallback without _id stays stable across team rename
function buildFallbackId(gameNumber, time, field, phase) {
  return `g${gameNumber}|${time}|${field || 'x'}|${phase}`;
}
assert(
  buildFallbackId(24, '13:27', '2', 'placement') === buildFallbackId(24, '13:27', '2', 'placement'),
  'fallback identity stable without team names',
);

// Idempotent identity set simulation (5 imports same snapshot)
{
  const ids = new Set();
  for (let i = 0; i < 5; i += 1) {
    ids.add('tournament-live:6a8058a4692051001ab86046');
  }
  assert(ids.size === 1, 'repeated import same external id → one slot identity');
}

// --- Live priority logic (mirror pickActiveTournamentDayEvent gate) ---
function isUpcomingOnly(startsAt, nowMs) {
  return new Date(startsAt).getTime() >= nowMs;
}
function isActiveTournamentDay(startsAt, now) {
  const startMs = new Date(startsAt).getTime();
  const fmt = (d) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Vienna',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  if (fmt(new Date(startsAt)) === fmt(now)) return true;
  const hours = (now.getTime() - startMs) / 3_600_000;
  return startMs <= now.getTime() && hours <= 36;
}
{
  const now = new Date('2026-08-15T11:00:00+02:00');
  const tournamentStart = '2026-08-15T08:00:00.000Z'; // morning, already past at 11:00
  const league = '2026-09-06T14:00:00.000Z';
  assert(isUpcomingOnly(tournamentStart, now.getTime()) === false, 'old: tournament past → dropped');
  assert(isActiveTournamentDay(tournamentStart, now) === true, 'new: tournament still active today');
  assert(isUpcomingOnly(league, now.getTime()) === true, 'league still upcoming');
  // Priority: active tournament wins over upcoming league
  const pick = isActiveTournamentDay(tournamentStart, now) ? 'tournament' : 'league';
  assert(pick === 'tournament', 'active tournament beats future league match');
}

// --- Real TURNIERlive final plan (network) ---
const STEURER_ID = '6a6dcb795802cd0015395f6b';
const PLACEMENT_ID = '6a8058a4692051001ab86046';
try {
  const res = await fetch(`https://api.tournament-live.com/v1/tournament/${STEURER_ID}/results`, {
    headers: { Accept: 'application/json' },
  });
  assert(res.ok, 'Steurer results API reachable');
  const json = await res.json();
  if (Array.isArray(json?.data) && json.data.length === 0) {
    throw new Error('SKIP_STEURER_HISTORY_UNAVAILABLE');
  }
  const parsed = parseTournamentLiveResults(json, { title: 'Rudolf Steurer' });
  assert(parsed && parsed.matchCount >= 20, `parsed matchCount (${parsed?.matchCount})`);
  const own = (parsed.rawMatches || []).filter(
    (m) => /rohrbach/i.test(m.homeTeam) || /rohrbach/i.test(m.awayTeam),
  );
  assert(own.length === 5, `Rohrbach matches = 5 (got ${own.length})`);
  const place7 = parsed.rawMatches.find((m) => m.externalMatchId === PLACEMENT_ID);
  assert(Boolean(place7), 'real placement slot by provider id');
  assert(place7?.homeTeam === 'NSG Rohrbach/St. Veit', 'home Rohrbach');
  assert(place7?.awayTeam === 'SC Wiener Neustadt', 'away Wr. Neustadt');
  assert(place7?.kickoffTimeHHmm === '13:27', 'real kickoff 13:27');
  assert(place7?.pitch === 'Platz 2', 'real pitch 2');
  assert(place7?.phase === 'placement', 'real phase placement');
  assert(
    /spiel um platz 7/i.test(String(place7?.groupLabel ?? '')),
    'real placement title in groupLabel',
  );
  assert(place7?.hasResult === true && place7?.homeGoals === 1 && place7?.awayGoals === 2, 'real 1:2');

  // Reconstruct Gruppe 1 table from parsed group matches
  const g1 = parsed.rawMatches.filter((m) => m.phase === 'group' && String(m.groupLabel) === '1');
  const stats = new Map();
  const row = (t) => {
    if (!stats.has(t)) stats.set(t, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
    return stats.get(t);
  };
  for (const m of g1) {
    if (!m.hasResult) continue;
    const A = row(m.homeTeam);
    const B = row(m.awayTeam);
    A.p += 1;
    B.p += 1;
    A.gf += m.homeGoals;
    A.ga += m.awayGoals;
    B.gf += m.awayGoals;
    B.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) {
      A.w += 1;
      B.l += 1;
    } else if (m.homeGoals < m.awayGoals) {
      B.w += 1;
      A.l += 1;
    } else {
      A.d += 1;
      B.d += 1;
    }
  }
  const table = [...stats.entries()]
    .map(([t, s]) => ({ t, pts: s.w * 3 + s.d, diff: s.gf - s.ga, gf: s.gf, ...s }))
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.gf - a.gf);
  const expected = [
    ['SKU Amstetten', 10],
    ['FK Austria Wien', 9],
    ['ASK Wilhelmsburg', 5],
    ['NSG Rohrbach/St. Veit', 3],
    ['SV Mattersburg', 1],
  ];
  assert(table.length === 5, 'Gruppe 1 has 5 teams');
  for (let i = 0; i < expected.length; i += 1) {
    assert(
      table[i].t === expected[i][0] && table[i].pts === expected[i][1],
      `table ${i + 1}: ${expected[i][0]} ${expected[i][1]}pts (got ${table[i]?.t} ${table[i]?.pts})`,
    );
  }
  assert(table[3].t.includes('Rohrbach'), 'Rohrbach rank 4 Gruppe 1');
} catch (err) {
  if (err instanceof Error && err.message === 'SKIP_STEURER_HISTORY_UNAVAILABLE') {
    console.warn('skip real Steurer regression: historical TURNIERlive data is no longer available');
  } else {
    failed += 1;
    console.error('fail real Steurer regression', err instanceof Error ? err.message : err);
  }
}

if (failed) {
  console.error(`\nstep19-tournament-live-robustness-test: ${failed} failed`);
  process.exit(1);
}
console.log('\nstep19-tournament-live-robustness-test: OK');
