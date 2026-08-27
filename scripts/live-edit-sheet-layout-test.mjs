/**
 * LIVE-EDIT-SHEET-LAYOUT – Korrektur-CTAs bleiben sichtbar und der Ticker nutzt die mobile Höhe.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screen = fs.readFileSync(path.join(root, 'src/pages/live/LiveMatchScreen.tsx'), 'utf8');
const bottomNav = fs.readFileSync(path.join(root, 'src/app/components/BottomNav.tsx'), 'utf8');
const layoutCss = fs.readFileSync(path.join(root, 'src/styles/layout.css'), 'utf8');

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
assert.ok(bottomNav.includes('data-app-bottom-nav'), 'the global BottomNav must expose a precise hide target');
assert.ok(
  screen.includes("document.body.toggleAttribute('data-live-edit-dialog-open', liveEditDialogOpen)"),
  'opening either live correction sheet must mark the document',
);
assert.ok(
  screen.includes("document.body.removeAttribute('data-live-edit-dialog-open')"),
  'the live correction marker must always be cleaned up',
);
assert.ok(
  layoutCss.includes('body[data-live-edit-dialog-open] [data-app-bottom-nav]'),
  'the global BottomNav must be hidden while a correction sheet owns the action area',
);
assert.ok(
  /onClick=\{\(\) => setEditingGoalEvent\(null\)\}[\s\S]{0,500}Zurück zum Livespiel/.test(screen),
  'the goal correction sheet must offer a visible return action without saving',
);
assert.ok(
  /onClick=\{\(\) => setEditingSubstitutionEvent\(null\)\}[\s\S]{0,500}Zurück zum Livespiel/.test(screen),
  'the substitution correction sheet must offer a visible return action without saving',
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
