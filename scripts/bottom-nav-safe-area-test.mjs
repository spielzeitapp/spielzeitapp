/**
 * BOTTOM-NAV.KNOWN-GOOD-RESTORE — position rules from 9c1471cc / 837db997.
 * Run: node scripts/bottom-nav-safe-area-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nav = fs.readFileSync(path.join(root, 'src/app/components/BottomNav.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/layout/InternalLayout.tsx'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'public/manifest-trainer.json'), 'utf8');

const navOpen = nav.indexOf('export const BottomNav');
const navEl = nav.slice(nav.indexOf('<nav', navOpen), nav.indexOf('</nav>', navOpen));

assert.ok(/\bbottom-0\b/.test(navEl), 'known-good: nav pinned with bottom-0');
assert.ok(
  navEl.includes("paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))'"),
  'known-good: single paddingBottom safe-area, not extra bottom offset',
);
assert.ok(!/bottom:\s*'max\(8px/.test(navEl), 'b20ac76b bottom-offset formula must not return');
assert.ok((navEl.match(/env\(safe-area-inset-bottom/g) || []).length === 1, 'safe-area applied once on nav');
assert.ok(!/transform:|translate\(|filter:|will-change/.test(navEl.split('>')[0]), 'nav element is viewport-fixed');

assert.ok(nav.includes('touch-manipulation'), 'tap delay avoided');
assert.ok(nav.includes('active:scale-[0.96]'), 'immediate click feedback');
assert.ok(nav.includes('min-h-[76px]'), 'app tab bar height unchanged');
assert.ok(nav.includes("to: '/app/home'"), 'home route unchanged');
assert.ok(nav.includes("to: '/app/termine'"), 'termine route unchanged');
assert.ok(nav.includes("to: '/app/team'"), 'team route unchanged');
assert.ok(nav.includes("to: '/app/live'"), 'live route unchanged');
assert.ok(nav.includes("to: '/app/mehr'"), 'mehr route unchanged');

assert.ok(
  layout.includes('pb-[max(10rem,calc(7.5rem+env(safe-area-inset-bottom,0px)))]'),
  'content padding restored; does not set nav bottom',
);
assert.ok(!layout.includes("bottom: 'max(8px"), 'layout does not reposition the fixed nav');
assert.ok(layout.includes('gatePassedUserIdRef'), 'Gate-1 cache unchanged');
assert.ok(
  layout.includes('gatePassedUserIdRef.current === userId && isAppShellTabPath'),
  'warm tab switches still skip gate',
);

assert.ok(indexHtml.includes('viewport-fit=cover'), 'viewport-fit kept');
assert.ok(indexHtml.includes('apple-mobile-web-app-capable'), 'PWA apple meta kept');
assert.ok(appHtml.includes('apple-mobile-web-app-capable'), 'PWA apple meta kept on app.html');
assert.ok(manifest.includes('"scope": "/"'), 'PWA scope kept');

console.log('bottom-nav-safe-area-test: OK');
