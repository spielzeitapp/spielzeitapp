import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/PlayerOnboardingPage.tsx', import.meta.url), 'utf8');

assert.match(source, /\.eq\('status', 'active'\)/, 'player onboarding must require an active season');
assert.match(source, /\.is\('archived_at', null\)/, 'player onboarding must exclude archived seasons');
assert.match(source, /listRoster\(String\(row\.id\), 'active'\)/, 'only seasons with an active roster may be offered');
assert.match(source, /roster\.data\.length > 0/, 'empty internal test teams must not be offered');
assert.match(source, /seasonNameById/, 'the current season must be visible in the team label');

console.log('player onboarding active-season checks passed');
