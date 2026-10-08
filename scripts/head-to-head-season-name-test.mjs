import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the same seasonal formatter used by the comparison, without a browser.
const result = await build({
  entryPoints: [new URL('../src/lib/seasonLifecycle.ts', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { resolveTeamSeasonLabelParts } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const base = { teamName: 'U11 SPG Rohrbach' };
assert.equal(resolveTeamSeasonLabelParts({ ...base, ageGroup: 'U12', displayName: 'U12 SPG Rohrbach · 2026/27', seasonName: '2026/27' }).teamLine, 'U12 SPG Rohrbach');
assert.equal(resolveTeamSeasonLabelParts({ ...base, seasonName: '2025/26' }).teamLine, 'U11 SPG Rohrbach');
assert.equal(resolveTeamSeasonLabelParts({ ...base, ageGroup: 'U13', seasonName: '2027/28' }).teamLine, 'U13 SPG Rohrbach');
assert.equal(resolveTeamSeasonLabelParts({ teamName: 'SPG Weinburg A', ageGroup: 'U12' }).teamLine, 'U12 SPG Weinburg A');
console.log('PASS: current U12, historical U11, next-season U13 and A-team names');
