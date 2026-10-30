import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/lib/seasonLifecycle.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const naming = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const base = { teamName: 'U11 SPG Rohrbach', ageGroup: 'U12', seasonName: '2026/27', displayName: 'U11 SPG Rohrbach · 2026/27' };
assert.equal(naming.formatTeamSeasonContextLabel(base), 'SPG Rohrbach · U12 · 2026/27');
assert.equal(naming.resolveTeamSeasonLabelParts(base).teamLine, 'U12 SPG Rohrbach');
assert.equal(naming.formatTeamSeasonContextLabel({ ...base, displayName: 'SPG Rohrbach · U12 · 2026/27' }), 'SPG Rohrbach · U12 · 2026/27');
assert.equal(naming.formatTeamSeasonContextLabel({ ...base, ageGroup: 'U11', seasonName: '2025/26', displayName: null, status: 'archived' }, { markArchived: true }), 'SPG Rohrbach · U11 · 2025/26 · Archiv');
assert.equal(naming.formatTeamSeasonContextLabel({ ...base, displayName: 'U12 SPG Rohrbach B · 2026/27' }), 'SPG Rohrbach B · U12 · 2026/27');
assert.equal(naming.formatTeamSeasonContextLabel({ teamName: 'USC Rohrbach', ageGroup: 'Kampfmannschaft', seasonName: '2026/27' }), 'USC Rohrbach · Kampfmannschaft · 2026/27');
assert.equal(naming.formatTeamSeasonContextLabel({ teamName: 'USC Rohrbach', ageGroup: 'U12', seasonName: '2026/27' }), 'USC Rohrbach · U12 · 2026/27');
assert.equal(naming.formatTeamSeasonContextLabel(base, { includeSeason: false }), 'SPG Rohrbach · U12');
assert.equal(naming.resolveTeamSeasonLabelParts({ displayName: 'SPG Rohrbach · U12 · 2026/27' }).full, 'SPG Rohrbach · U12 · 2026/27');
assert.equal(naming.buildPreparedSeasonDisplayName({ teamName: 'U11 SPG Rohrbach', targetAgeGroup: 'U13', targetSeasonName: '2027/28' }), 'SPG Rohrbach · U13 · 2027/28');
assert.equal(naming.formatTeamSeasonCompactSwitcherLabel(base), 'SPG Rohrbach · U12 · 2026/27');
console.log('team-season-naming-test: OK (legacy names, archive, team suffix, multiple clubs, senior teams and next season)');

assert.equal(naming.formatTeamSeasonContextLabel({ teamName: 'SC Melk FR U16', ageGroup: 'U16', seasonName: '2026/27' }), 'SC Melk FR · U16 · 2026/27');
assert.equal(naming.formatTeamSeasonContextLabel({ teamName: 'SC Melk FR U16', displayName: 'SC Melk FR U16 · U16 · 2026/27', ageGroup: 'U16', seasonName: '2026/27' }), 'SC Melk FR · U16 · 2026/27');
assert.equal(naming.formatTeamSeasonContextLabel({ teamName: 'SC Melk FR KM', ageGroup: 'KM', seasonName: '2026/27' }), 'SC Melk FR · KM · 2026/27');
