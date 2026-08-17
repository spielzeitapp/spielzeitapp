/**
 * BOTTOM-NAV.SAFE-AREA-POSITION — one safe-area offset, no double inset.
 * Run: node scripts/bottom-nav-safe-area-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nav = fs.readFileSync(path.join(root, 'src/app/components/BottomNav.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/layout/InternalLayout.tsx'), 'utf8');

const navOpen = nav.indexOf('export const BottomNav');
const navEl = nav.slice(nav.indexOf('<nav', navOpen), nav.indexOf('</nav>', navOpen));

assert.ok(
  navEl.includes("bottom: 'max(8px, env(safe-area-inset-bottom, 0px))'"),
  'nav uses a single bottom safe-area offset',
);
assert.ok(!/\bbottom-0\b/.test(navEl), 'nav is not pinned with bottom-0 plus inset padding');
assert.ok(!/paddingBottom/.test(navEl), 'nav has no extra paddingBottom safe-area');
assert.ok(!/\bpb-\d/.test(navEl.split('>')[0]), 'nav element has no extra Tailwind bottom padding');
assert.ok(!/marginBottom|mb-/.test(navEl.split('>')[0]), 'nav element has no extra bottom margin');

assert.ok(nav.includes('touch-manipulation'), 'tap delay avoided');
assert.ok(nav.includes('active:scale-[0.96]'), 'immediate click feedback');
assert.ok(nav.includes('min-h-[76px]'), 'app tab bar height unchanged');
assert.ok(nav.includes("to: '/app/home'"), 'home route unchanged');
assert.ok(nav.includes("to: '/app/termine'"), 'termine route unchanged');
assert.ok(nav.includes("to: '/app/team'"), 'team route unchanged');
assert.ok(nav.includes("to: '/app/live'"), 'live route unchanged');
assert.ok(nav.includes("to: '/app/mehr'"), 'mehr route unchanged');

assert.ok(
  layout.includes('pb-[calc(5.75rem+max(8px,env(safe-area-inset-bottom,0px)))]'),
  'content padding tracks nav height plus one safe-area offset',
);
assert.ok(layout.includes('gatePassedUserIdRef'), 'Gate-1 cache unchanged');
assert.ok(
  layout.includes('gatePassedUserIdRef.current === userId && isAppShellTabPath'),
  'warm tab switches still skip gate',
);

console.log('bottom-nav-safe-area-test: OK');
