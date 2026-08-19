/**
 * Runtime-Test: peakStatusForFieldDay darf computeFieldDaySlots nicht positional aufrufen.
 * Ausführen: node scripts/platz-week-computeFieldDaySlots-runtime-test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const tmpDir = mkdtempSync(join(tmpdir(), 'platz-week-rt-'));
const outFile = join(tmpDir, 'runtime-test.cjs');

const testSource = `
import assert from 'node:assert/strict';
import { computeFieldDaySlots } from ${JSON.stringify(join(root, 'src/manager/platz/availabilityHelpers.ts'))};

assert.throws(
  () => computeFieldDaySlots('f1', '2026-08-19', [], []),
  (err) => err instanceof TypeError && String(err).includes('filter'),
  'Positionsaufruf wirft undefined.filter',
);

const slots = computeFieldDaySlots({
  fieldId: 'f1',
  dayKey: '2026-08-19',
  candidates: [],
  zones: [],
});
assert.ok(Array.isArray(slots) && slots.length > 0, 'Objektaufruf liefert Slots');
console.log('platz-week computeFieldDaySlots runtime: OK');
`;

try {
  esbuild.buildSync({
    stdin: { contents: testSource, loader: 'ts', resolveDir: root },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: outFile,
  });
  execFileSync(process.execPath, [outFile], { stdio: 'inherit', cwd: root });
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
