import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/landingpage.html', import.meta.url), 'utf8');
const clean = html.split('/* Clean brand hero:')[1].split('</style>')[0];
assert.ok(clean.includes('flex-direction:row'), 'Logo and wordmark must be side by side');
assert.ok(clean.includes('.hero-signature{position:relative;inset:auto;width:100%'), 'Signature must stay in document flow');
assert.ok(!html.includes('top:calc(96.91vw'), 'No fixed mobile photo offset');
assert.ok(clean.includes('.hero{height:auto;min-height:0'), 'Hero must grow to fit its content');
assert.ok(clean.includes('.hero-signature .hero-phone-preview{position:relative'), 'Phone must not overlap photo or slogan');
for (const text of ['Unser Team.', 'Unsere Momente.', 'Unser Spiel.']) assert.ok(html.includes(text));
assert.ok(html.includes('href="/demo"'), 'Test demo link remains local');
assert.ok(html.includes('class="emotion-phone-screen"'), 'Scorer replacement must anchor to the actual image dimensions');
assert.ok(html.includes('top:52%;width:81.4%;height:8%'), 'Replacement must cover both original scorer rows');
for (const name of ['Noah Kramer', 'Lena Mayer', 'Elias Fischer']) assert.ok(html.includes(name));
console.log('Clean landingpage hero regression checks passed');
