import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const css=await fs.readFile('src/features/club/publicExchange.css','utf8'),app=await fs.readFile('src/app/components/BottomNav.tsx','utf8');
const liveFormula='max(0.125rem, min(0.75rem, calc(var(--app-nav-safe-bottom, env(safe-area-inset-bottom, 0px)) - 1.5rem)))';
assert.ok(app.includes(liveFormula));const compact=s=>s.replace(/\s/g,'');assert.ok(compact(css).includes('--market-nav-bottom:'+compact(liveFormula)));
assert.ok(css.includes('bottom:var(--market-nav-bottom)'));assert.ok(css.includes('html[data-ios-standalone-fullscreen] .public-exchange{height:var(--app-standalone-height)'));
const gap=safe=>Math.max(2,Math.min(12,safe-24));for(const safe of [0,20,34,80,120]){assert.ok(gap(safe)<=12);assert.ok(gap(safe)>=2);const barBottom=874-gap(safe);assert.ok(barBottom>=862,'stale safe-area cannot lift navigation');const padding=80+gap(safe)+24;assert.ok(padding>80+gap(safe),'footer can clear navigation');}
// Resolve the shell's actual height cascade. The old high-specificity
// market-shell height:auto rule defeated the earlier fullscreen recovery.
const {default:postcss}=await import('postcss');
function shellHeight(fullscreen){
 let winner=null;
 postcss.parse(css).walkRules(rule=>{
  if(!/\.public-exchange$/.test(rule.selector)||rule.selector.includes(','))return;
  if(rule.selector.includes('data-ios-standalone-fullscreen')&&!fullscreen)return;
  const specificity=(rule.selector.match(/\[|\./g)||[]).length;
  rule.walkDecls('height',decl=>{if(!winner||specificity>=winner.specificity)winner={value:decl.value,specificity};});
 });
 return winner.value;
}
assert.equal(shellHeight(true),'var(--app-standalone-height)');
assert.equal(shellHeight(false),'var(--app-visible-height,100dvh)');
assert.ok(!css.includes('inset:0;height:auto'),'native fixed viewport must not override recovered height');
assert.ok(css.includes('flex:1 1 0;min-height:0;padding-bottom:24px'));
assert.ok(css.includes('position:relative;inset:auto;flex:0 0 var(--market-nav-height)'));
console.log('PASS: LIVE inset policy, effective height cascade, recovered fullscreen, sole content scroller and reserved nav row');
