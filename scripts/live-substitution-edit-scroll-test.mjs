/**
 * LIVE-SUBSTITUTION-EDIT-SCROLL – Wechsel korrigierbar, Liveticker mit nur einem Scrollcontainer.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screen = fs.readFileSync(path.join(root, 'src/pages/live/LiveMatchScreen.tsx'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/lib/liveMatchService.ts'), 'utf8');

assert.ok(
  service.includes('export async function updateSubstitutionPlayers('),
  'live service must expose a safe substitution correction',
);
assert.ok(
  service.includes(".update({ player_id: outId, payload: { player_in_id: inId } })"),
  'substitution correction must update outgoing and incoming players atomically',
);
assert.ok(
  service.includes("if (row.type !== 'substitution')"),
  'legacy or unrelated event rows must not be overwritten',
);
assert.ok(
  screen.includes('Wechsel korrigieren') && screen.includes('saveEditedSubstitution'),
  'trainer ticker must offer a substitution edit dialog',
);
assert.ok(
  screen.includes('firstInvalidAtomicSubstitution'),
  'an edit must protect the consistency of later substitutions',
);
assert.ok(
  screen.includes('syncFinalLineupBenchFromEventReplay({'),
  'field, bench and playtime replay must be refreshed after an edit',
);
assert.ok(
  screen.includes("mainTab === 'events'") &&
    screen.includes("'flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2"),
  'the events page must not compete with the ticker list as a second scroll container',
);
assert.ok(
  screen.includes('touch-pan-y space-y-0 overflow-y-auto overscroll-y-contain'),
  'the ticker list must own the mobile touch scroll',
);

console.log('live-substitution-edit-scroll-test: OK');
