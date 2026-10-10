import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const manifest = JSON.parse(read('public/manifest-demo.json'));
assert.equal(manifest.id, '/demo/');
assert.equal(manifest.start_url, '/demo/intro/splash');
assert.equal(manifest.scope, '/demo/');
assert.equal(manifest.display, 'standalone');
assert.equal(JSON.parse(read('public/manifest-trainer.json')).start_url, '/app');
const html = read('index.html');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('manifest-demo.json'));
assert.ok(script, 'Demo metadata available before React starts');
for (const pathname of ['/demo', '/demo/', '/demo/termine', '/demo/intro/welcome', '/app', '/manager', '/demography']) {
  const attrs = { manifest: '/manifest-trainer.json', title: 'SpielzeitApp' };
  const document = { title: 'Spielzeit', querySelector: selector => ({setAttribute: (_, v) => { attrs[selector.startsWith('link') ? 'manifest' : 'title'] = v; }}) };
  vm.runInNewContext(script, {window: {location: {pathname}}, document});
  const demo = pathname === '/demo' || pathname.startsWith('/demo/');
  assert.equal(attrs.manifest, demo ? '/manifest-demo.json' : '/manifest-trainer.json');
  assert.equal(attrs.title, demo ? 'Spielzeit Demo' : 'SpielzeitApp');
}
const sync = read('src/app/ManifestSync.tsx');
assert.match(sync, /const href = demo\s*\? '\/manifest-demo.json'/);
assert.ok(JSON.parse(read('vercel.json')).headers.some(h => h.source === '/manifest-demo.json'));
const app = read('src/app/App.tsx');
assert.equal((app.match(/path="intro\/splash" element={<SplashScreen \/>}/g) || []).length >= 2, true);
console.log('Demo PWA entry: OK (own identity, public splash, early metadata, normal app unchanged)');
