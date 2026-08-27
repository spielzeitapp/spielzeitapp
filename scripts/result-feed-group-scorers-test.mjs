/**
 * RESULT-FEED-GROUP-SCORERS – Mehrere Tore eines Spielers werden kompakt gebündelt.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'src/components/feed/ResultFeedPostCard.tsx'),
  'utf8',
);

assert.ok(
  source.includes('function groupScorersByPlayer('),
  'result feed must group scorers by player',
);
assert.ok(
  source.includes("playerName.toLocaleLowerCase('de-AT')"),
  'player grouping must be case-insensitive',
);
assert.ok(
  source.includes("scorer.goalCount === 1 ? 'Tor' : 'Tore'"),
  'grouped rows must show the goal count',
);
assert.ok(
  source.includes("scorer.minutes.join(' · ')"),
  'grouped rows must retain every goal minute',
);
assert.ok(
  !source.includes('filteredScorers.map((s, i)'),
  'the feed must no longer render one row per goal event',
);

console.log('result-feed-group-scorers-test: OK');
