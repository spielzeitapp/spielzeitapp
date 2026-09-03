import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/parentChildLink.ts', import.meta.url), 'utf8');

assert.match(source, /formatOnboardingTeamLabel\(row\.label\)/);
assert.match(source, /replace\(\/\^u\\d\{1,2\}\\b\\s\*\/i, ''\)/);

const format = (label) => {
  const normalized = String(label ?? '').replace(/\s+/g, ' ').trim();
  return normalized.replace(/^u\d{1,2}\b\s*/i, '').trim() || normalized || 'Mannschaft';
};

assert.equal(format('U11 SPG Rohrbach'), 'SPG Rohrbach');
assert.equal(format('U12  SPG Rohrbach'), 'SPG Rohrbach');
assert.equal(format('Kampfmannschaft'), 'Kampfmannschaft');
assert.equal(format(''), 'Mannschaft');

console.log('parent onboarding team label checks passed');
