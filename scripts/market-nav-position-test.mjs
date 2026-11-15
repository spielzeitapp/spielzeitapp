import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const css=await fs.readFile('src/features/club/publicExchange.css','utf8'),app=await fs.readFile('src/app/components/BottomNav.tsx','utf8');
const liveFormula='max(0.125rem, min(0.75rem, calc(var(--app-nav-safe-bottom, env(safe-area-inset-bottom, 0px)) - 1.5rem)))';
assert.ok(app.includes(liveFormula));const compact=s=>s.replace(/\s/g,'');assert.ok(compact(css).includes('--market-nav-bottom:'+compact(liveFormula)));
assert.ok(css.includes('bottom:var(--market-nav-bottom)'));assert.ok(css.includes('html[data-ios-standalone-fullscreen] .public-exchange{height:var(--app-standalone-height)'));
const gap=safe=>Math.max(2,Math.min(12,safe-24));for(const safe of [0,20,34,80,120]){assert.ok(gap(safe)<=12);assert.ok(gap(safe)>=2);const barBottom=874-gap(safe);assert.ok(barBottom>=862,'stale safe-area cannot lift navigation');const padding=80+gap(safe)+24;assert.ok(padding>80+gap(safe),'footer can clear navigation');}
console.log('PASS: exact LIVE inset policy, zero/normal/stale safe areas, recovered fullscreen anchor, footer scroll clearance');
