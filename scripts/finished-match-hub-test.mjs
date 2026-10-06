import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/pages/EventDetailPage.tsx', import.meta.url), 'utf8');
assert.match(source, /Highlights · Spielszenen · Analyse/);
assert.doesNotMatch(source, /id: 'analysis', label: 'Spielanalyse'/);
assert.match(source, /id === 'videos' \? 'col-span-2'/);
assert.match(source, /MatchVideosPanel onBack=/);
assert.doesNotMatch(source, /finishedTab === 'analysis'/);
console.log('PASS: completed matches use a full-width combined Videos tile and shared video panel');
