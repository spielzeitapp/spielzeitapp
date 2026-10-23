fatal: /dev/null: '/dev/null' is outside repository at '/workspace/scratch/03ac037b11e3/landingpage-live'
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
assert.ok(html.includes('class="emotion-phone-screen"'), 'Result screen stays inside its phone frame');
assert.ok(!html.includes('class="demo-scorers"'), 'Original result screenshot must not have stale demo scorers overlaid');
assert.ok(html.includes('/landingpage-assets/rohrbach-loosdorf-preview.webp'), 'Hero shows the Loosdorf fixture');
assert.ok(html.includes('/landingpage-assets/rohrbach-loosdorf-5-4.webp'), 'Closing section shows the same match ending 5:4');
console.log('Clean landingpage hero regression checks passed');