/**
 * STAGING-ORG.1-FIX.1 — kindColor must remain defined for occupancy week-grid render.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(
  path.join(root, 'src/manager/ManagerPlatzbelegungPage.tsx'),
  'utf8',
);

assert.ok(
  /function\s+kindColor\s*\(\s*kind\s*:\s*string\s*\)\s*:\s*string/.test(page),
  'kindColor helper must be defined (PLATZ.6 regression)',
);
assert.ok(page.includes('kindColor(b.event.kind)'), 'week grid must call kindColor');

const defIdx = page.search(/function\s+kindColor\s*\(/);
const useIdx = page.indexOf('kindColor(b.event.kind)');
assert.ok(defIdx >= 0 && useIdx > defIdx, 'kindColor must be defined before use');

// Mirror helper — prevents silent rename/removal leaving a dead call site.
function kindColor(kind) {
  if (kind === 'match') return 'bg-red-700 text-white';
  if (kind === 'training') return 'bg-emerald-700 text-white';
  if (kind === 'tournament') return 'bg-amber-600 text-white';
  return 'bg-slate-600 text-white';
}

for (const kind of ['match', 'training', 'tournament', 'event', '']) {
  const cls = kindColor(kind);
  assert.equal(typeof cls, 'string');
  assert.ok(cls.length > 0);
  assert.ok(!cls.includes('undefined'));
}

assert.ok(page.includes("if (kind === 'match') return 'bg-red-700 text-white'"));
assert.ok(page.includes("if (kind === 'training') return 'bg-emerald-700 text-white'"));
assert.ok(page.includes('Nur ansehen'));
assert.ok(page.includes('eventTeamLabel'));
assert.ok(page.includes('isSharedForeign') || page.includes('canEditOverride'));

console.log('platz-occupancy-kind-color-test: OK');
