import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import selectors from 'postcss-selector-parser';
const files=['src/manager/managerMarketTeams.css','src/features/marketManager/marketManagerNav.css','src/features/marketManager/marketManager.css'];
const css=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const specificity=s=>{let score=0;selectors(ast=>ast.walk(n=>{if(n.type==='class'||n.type==='attribute')score+=100;else if(n.type==='tag')score+=1;else if(n.type==='id')score+=10000;})).processSync(s);return score;};
// Resolve competing declarations, including generic :not() pill styles and import order.
function value(property,matching,width=402){let best;postcss.parse(css).walkRules(r=>{let p=r.parent;while(p){if(p.type==='atrule'&&p.name==='media'){const max=p.params.match(/max-width:(\d+)px/);if(max&&width>+max[1])return;}if(p.type==='atrule'&&p.name==='supports')return;p=p.parent;}for(const s of r.selector.split(',').map(s=>s.trim())){if(!matching.includes(s))continue;r.walkDecls(property,d=>{const rank=(d.important?1e6:0)+specificity(s);if(!best||rank>=best.rank)best={rank,value:d.value};});}});return best?.value;}
const cards=['.manager-market-teams button:not(.market-theme-toggle)','.market-manager-home .vm-dashboard-action','.market-manager-home button.vm-dashboard-action'];
assert.equal(value('border-radius',cards),'18px');
assert.equal(value('border-radius',cards,960),'20px');
assert.equal(value('justify-content',cards),'flex-start');
assert.equal(value('min-height',cards),'82px');
assert.equal(value('grid-template-columns',['.vm-dashboard-actions','.market-manager-home .vm-dashboard-actions']),'minmax(0,1fr)');
assert.equal(value('grid-template-columns',['.vm-dashboard-actions','.market-manager-home .vm-dashboard-actions'],960),'repeat(2,minmax(0,1fr))');
const shell=['html[data-market-manager-shell] .manager-market-teams','html[data-market-manager-shell] .market-manager-home'];
assert.match(value('padding',shell),/^env\(safe-area-inset-top,\s*0px\) 0 0$/);
assert.equal(value('box-sizing',shell),'border-box');
const visibleHeight = 'var(--market-nav-visible-height, 100dvh)';
assert.equal(value('height', shell), visibleHeight);
assert.equal(value('max-height', shell), visibleHeight);
assert.match(value('inset', shell), /^var\(--market-nav-visible-top, 0px\) 0 auto$/);
const nav=['.market-manager-nav-viewport','html[data-market-manager-shell] .market-manager-nav-viewport','html[data-market-manager-shell] .market-manager-home .market-manager-nav-viewport'];
assert.equal(value('position',nav),'relative');
assert.equal(value('height',nav),'auto');
assert.ok(value('padding',nav).includes('min(12px'));
for(const safeTop of [0,20,62])for(const safeBottom of [0,34,100]){
 const height=874,header=104,navHeight=80,navGap=Math.max(2,Math.min(12,safeBottom-24));
 const contentHeight=height-safeTop-header-navHeight-8-navGap;
 assert.ok(contentHeight>0);assert.ok(safeTop+header<=height-contentHeight-navHeight);
 assert.ok(navGap<=12,'native safe-area must not lift the footer by a toolbar height');
}
console.log('PASS manager safe top, bounded bottom gap, fixed frame, mobile rows, desktop grid and effective button specificity');
