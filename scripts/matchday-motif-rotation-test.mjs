import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const motifPath = path.join(root, 'src/lib/matchdayPlayerMotif.ts');
const motifSource = fs.readFileSync(motifPath, 'utf8');
const transpiled = ts.transpileModule(motifSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const generatedModule = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const {
  MATCHDAY_DEMO_PLAYER_CANDIDATES,
  chooseMatchdayPlayerMotif,
  eventOverrideMatchdayMotif,
} = await import(generatedModule);

const candidates = [
  { playerId: 'p01', imageUrl: 'https://img/p01.png', playerName: 'Spieler 1' },
  { playerId: 'p02', imageUrl: 'https://img/p02.png', playerName: 'Spieler 2' },
  { playerId: 'p03', imageUrl: 'https://img/p03.png', playerName: 'Spieler 3' },
];

assert.equal(chooseMatchdayPlayerMotif({ eventId: 'ev-1', candidates: [] }), null);
const first = chooseMatchdayPlayerMotif({ eventId: 'ev-1', candidates });
const repeated = chooseMatchdayPlayerMotif({ eventId: 'ev-1', candidates });
assert.deepEqual(repeated, first, 'same event keeps same deterministic motif');

const next = chooseMatchdayPlayerMotif({
  eventId: 'ev-2',
  candidates,
  previousPlayerId: first.playerId,
});
assert.notEqual(next.playerId, first.playerId, 'previous player is not repeated when alternatives exist');

const only = chooseMatchdayPlayerMotif({
  eventId: 'ev-only',
  candidates: [candidates[0]],
  previousPlayerId: 'p01',
});
assert.equal(only.playerId, 'p01', 'single available motif remains usable');
assert.equal(eventOverrideMatchdayMotif('  https://img/manual.png  ').source, 'event_override');

const demoFirst = chooseMatchdayPlayerMotif({
  eventId: 'demo-event-1',
  candidates: MATCHDAY_DEMO_PLAYER_CANDIDATES,
  source: 'demo_fallback',
});
const demoNext = chooseMatchdayPlayerMotif({
  eventId: 'demo-event-2',
  candidates: MATCHDAY_DEMO_PLAYER_CANDIDATES,
  previousPlayerId: demoFirst.playerId,
  source: 'demo_fallback',
});
assert.equal(demoFirst.source, 'demo_fallback');
assert.notEqual(demoNext.playerId, demoFirst.playerId, 'demo fallback rotates without repetition');
assert.ok(
  MATCHDAY_DEMO_PLAYER_CANDIDATES.every((candidate) => candidate.imageUrl.startsWith('/feed/')),
  'demo fallback uses bundled feed assets',
);
for (const candidate of MATCHDAY_DEMO_PLAYER_CANDIDATES) {
  assert.ok(
    fs.existsSync(path.join(root, 'public', candidate.imageUrl.replace(/^\//, ''))),
    `demo fallback asset exists: ${candidate.imageUrl}`,
  );
}

const ensureSource = fs.readFileSync(path.join(root, 'src/lib/ensureMatchdayFeedPosts.ts'), 'utf8');
const cardSource = fs.readFileSync(path.join(root, 'src/components/feed/MatchdayFeedPostCard.tsx'), 'utf8');
assert.ok(ensureSource.includes('resolveMatchdayPlayerMotif(event)'), 'autopost resolves player motif');
assert.ok(ensureSource.includes('loadExistingEventMotif(event.id)'), 'today/tomorrow reuse same motif');
assert.ok(ensureSource.includes('MATCHDAY_DEMO_PLAYER_CANDIDATES'), 'autopost has demo fallback');
assert.ok(
  cardSource.includes('playerImageUrl={posterPlayerImageUrl}'),
  'feed poster receives stored motif or legacy demo fallback',
);
console.log('matchday-motif-rotation-test: OK');
