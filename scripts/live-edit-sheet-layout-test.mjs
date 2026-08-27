/**
 * LIVE-EDIT-SHEET-LAYOUT – Korrektur-CTAs bleiben sichtbar und der Ticker nutzt die mobile Höhe.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screen = fs.readFileSync(path.join(root, 'src/pages/live/LiveMatchScreen.tsx'), 'utf8');

const elevatedEditOverlays = screen.match(
  /fixed inset-0 z-\[10020\] flex min-h-dvh flex-col justify-end[^\"]*pt-\[var\(--app-header-offset\)\]/g,
);
assert.equal(
  elevatedEditOverlays?.length,
  2,
  'goal and substitution edit sheets must fill the area below the app header and cover BottomNav',
);

const fullHeightEditSheets = screen.match(
  /flex h-full min-h-0 flex-col overflow-hidden rounded-t-3xl/g,
);
assert.equal(
  fullHeightEditSheets?.length,
  2,
  'goal and substitution edit sheets must use the full available mobile height',
);

assert.ok(
  screen.includes('min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-4'),
  'long player selections must scroll independently of their action footer',
);
assert.ok(
  screen.includes('shrink-0 border-t border-white/10 bg-black/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3'),
  'edit actions must stay in a safe-area-aware fixed footer',
);

assert.ok(
  screen.includes("pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:px-4 md:pt-4"),
  'the ticker must reserve only the actual BottomNav height',
);
assert.ok(
  screen.includes('flex min-h-0 flex-1 flex-col gap-3 px-1 pb-1 sm:px-2'),
  'the ticker wrapper must not add a second large bottom gap',
);

console.log('live-edit-sheet-layout-test: OK');
