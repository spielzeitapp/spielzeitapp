import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build, transformSync } = require('esbuild');
const policy = {module:{exports:{}}};
vm.runInNewContext(transformSync(fs.readFileSync('src/lib/standaloneViewport.ts','utf8'),{loader:'ts',format:'cjs'}).code,policy);
const input = {ios:true,standalone:true,screenWidth:402,screenHeight:874,innerWidth:402,innerHeight:812,visibleHeight:812,visibleTop:0,scale:1,editing:false};
const height = policy.module.exports.standaloneFullscreenHeight;
assert.equal(height(input),874);
assert.equal(height({...input,innerHeight:874,visibleHeight:874}),874);
for (const change of [{ios:false},{standalone:false},{editing:true},{scale:1.5},{visibleHeight:500},{innerWidth:700},{visibleTop:90},{screenHeight:NaN}]) assert.equal(height({...input,...change}),null);
// Exact N7 iPhone report: 402x874 screen, 473x955 layout, 85% page zoom.
const pageZoom={...input,innerWidth:473,innerHeight:955,visibleHeight:955,scale:0.8500000238418579};
assert.ok(Math.abs(height(pageZoom) * pageZoom.scale - 874) < 0.001);
assert.ok(height(pageZoom) > 1028 && height(pageZoom) < 1029);
assert.equal(height({...pageZoom,editing:true}),null);
assert.equal(height({...pageZoom,visibleHeight:500}),null);
assert.equal(height({...pageZoom,standalone:false}),null);
assert.equal(height({...pageZoom,scale:0.7}),null,'pinch zoom must not be mistaken for page zoom');
assert.equal(height({...input,innerWidth:402,scale:0.85}),null);
for(const scale of [0.5,0.75,0.85,1,1.15,1.25,2]){
 const z={...input,scale,innerWidth:Math.round(402/scale),innerHeight:812/scale,visibleHeight:812/scale};
 assert.ok(Math.abs(height(z)*scale-874)<0.001);
}
const bundle=await build({entryPoints:['src/hooks/useViewportRecovery.ts'],bundle:true,write:false,format:'cjs',plugins:[{name:'lifecycle-isolation',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'mock'}));b.onResolve({filter:/bodyScrollLock$/},()=>({path:'locks',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='react'?'export const useLayoutEffect=fn=>{globalThis.cleanup=fn();};':'export const hasActiveBodyScrollLocks=()=>false;export const forceReleaseBodyScrollLocks=()=>{};'}));}}]});
let marketShell=false,safeTop=0;
const values=new Map();const root={hasAttribute:name=>name==='data-market-shell'&&marketShell,dataset:{},style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
class Element {constructor(editing=false){this.isContentEditable=false;this.editing=editing;}matches(){return this.editing;}}
const doc=Object.assign(new EventTarget(),{body:{appendChild(){}},createElement:()=>({style:{},remove(){}}),documentElement:root,visibilityState:'visible',activeElement:new Element()});
const vv=Object.assign(new EventTarget(),{height:812,width:402,offsetTop:0,scale:1});
let id=0;const timers=new Map(),frames=new Map();
const win=Object.assign(new EventTarget(),{innerWidth:402,innerHeight:812,visualViewport:vv,screen:{width:402,height:874},matchMedia:()=>({matches:true}),setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
const entryStorage=new Map();win.location={pathname:'/app/home'};win.sessionStorage={getItem:k=>entryStorage.get(k)??null,setItem:(k,v)=>entryStorage.set(k,v)};
const ctx={getComputedStyle:()=>({paddingTop:String(safeTop)+'px'}),module:{exports:{}},window:win,document:doc,navigator:{userAgent:'iPhone',standalone:true,platform:'iPhone',maxTouchPoints:5},HTMLElement:Element,requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),console};
vm.runInNewContext(bundle.outputFiles[0].text,ctx);ctx.module.exports.useViewportRecovery();
assert.equal(values.get('--app-visible-height'),'874px');assert.equal(root.dataset.iosStandaloneFullscreen,'true');
for(const fn of [...timers.values()])fn();
assert.equal(values.get('--app-visible-height'),'874px');
win.innerHeight=874;vv.height=874;vv.dispatchEvent(new Event('resize'));
assert.equal(values.get('--app-visible-height'),'874px');
doc.activeElement=new Element(true);doc.dispatchEvent(new Event('focusin'));vv.height=500;vv.offsetTop=20;vv.dispatchEvent(new Event('resize'));
assert.equal(root.dataset.iosStandaloneFullscreen,undefined);assert.equal(values.get('--app-visible-height'),'500px');assert.equal(values.get('--app-visible-top'),'20px');
doc.activeElement=new Element();win.innerHeight=812;vv.height=812;vv.offsetTop=0;win.dispatchEvent(new Event('pageshow'));
assert.equal(values.get('--app-visible-height'),'874px');
vv.scale=1.5;vv.height=400;vv.dispatchEvent(new Event('resize'));assert.equal(values.get('--app-visible-height'),'874px');assert.equal(root.dataset.iosStandaloneFullscreen,undefined);
// The old hook skipped all height variables when scale wasn't 1.
// Reproduce the actual first-load report, then keyboard, resume and pinch.
win.innerWidth=473;win.innerHeight=955;vv.width=473;vv.height=955;vv.scale=pageZoom.scale;
values.clear();vv.dispatchEvent(new Event('resize'));
const fullZoomHeight=Number.parseFloat(values.get('--app-visible-height'));
assert.ok(Math.abs(fullZoomHeight*vv.scale-874)<0.001);
assert.equal(root.dataset.iosStandaloneFullscreen,'true');
assert.equal(values.get('--app-standalone-height'),values.get('--app-visible-height'));
for(const safe of [0,34,80]){
 const navGap=Math.max(2,Math.min(12,safe-24));
 const navBottom=(fullZoomHeight-navGap)*vv.scale;
 assert.ok(874-navBottom < 11,'85% page zoom must not leave the old 62px strip');
}
doc.activeElement=new Element(true);vv.height=550;doc.dispatchEvent(new Event('focusin'));
assert.equal(root.dataset.iosStandaloneFullscreen,undefined);
assert.equal(values.get('--app-visible-height'),'550px','keyboard still shrinks zoomed viewport');
doc.activeElement=new Element();vv.height=955;win.dispatchEvent(new Event('pageshow'));
assert.equal(root.dataset.iosStandaloneFullscreen,'true');
assert.equal(Number.parseFloat(values.get('--app-visible-height')),fullZoomHeight);
vv.scale=0.7;vv.height=1100;vv.dispatchEvent(new Event('resize'));
assert.equal(Number.parseFloat(values.get('--app-visible-height')),fullZoomHeight);
assert.equal(root.dataset.iosStandaloneFullscreen,undefined);
// Reinstalled opaque status bar reserves 62 physical px outside viewport.
marketShell=true;safeTop=0;vv.scale=pageZoom.scale;vv.height=955;
// Enter market from SpielzeitApp without resize: discard the previous fullscreen height.
win.dispatchEvent(new Event('spz-viewport-recover'));
assert.equal(root.dataset.iosStandaloneFullscreen,undefined);
assert.equal(values.get('--app-visible-height'),'955px');
assert.equal(values.get('--market-native-bottom-extension'),'0px','opaque status bar needs no native extension');
assert.equal(values.has('--app-standalone-height'),false);
const opaqueNavBottom=62+(955-10)*vv.scale;
assert.ok(opaqueNavBottom<874 && opaqueNavBottom>860,'entire nav remains inside physical screen');
safeTop=62;vv.dispatchEvent(new Event('resize'));
assert.equal(values.get('--market-native-bottom-extension'),'0px','SpielzeitApp header switch must not use standalone market extension');
ctx.cleanup();win.location.pathname='/marktplatz/9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
ctx.module.exports.useViewportRecovery();
assert.equal(values.get('--market-native-bottom-extension'),'0px','theme reload keeps app-window geometry');
ctx.cleanup();entryStorage.clear();ctx.module.exports.useViewportRecovery();
assert.ok(Math.abs(Number.parseFloat(values.get('--market-native-bottom-extension'))*vv.scale-(874-955*vv.scale))<0.001);
win.innerWidth=402;win.innerHeight=812;vv.scale=1;vv.height=812;vv.dispatchEvent(new Event('resize'));
assert.equal(values.get('--market-native-bottom-extension'),'62px','exact N8 fixed viewport report');
doc.activeElement=new Element(true);doc.dispatchEvent(new Event('focusin'));
assert.equal(values.get('--market-native-bottom-extension'),'0px','keyboard must not push nav beneath keyboard');
doc.activeElement=new Element();win.innerWidth=473;win.innerHeight=955;vv.scale=pageZoom.scale;vv.height=955;vv.dispatchEvent(new Event('resize'));
assert.equal(root.dataset.iosStandaloneFullscreen,undefined,'market must use visible height even with a nonzero safe area');
assert.equal(values.get('--app-visible-height'),'955px');
for (const scale of [0.75, 0.85, 1, 1.25]) {
 win.innerWidth=402/scale;win.innerHeight=812/scale;vv.scale=scale;vv.height=812/scale;
 win.dispatchEvent(new Event('pageshow'));
 assert.equal(root.dataset.iosStandaloneFullscreen,undefined);
 assert.ok(Math.abs(Number.parseFloat(values.get('--app-visible-height'))*scale-812)<0.001,'market stays within usable screen at every page zoom');
 for (const fn of [...timers.values()]) fn();
 assert.ok(Math.abs(Number.parseFloat(values.get('--app-visible-height'))*scale-812)<0.001,'delayed recovery must not expand market');
 doc.activeElement=new Element(true);vv.height=450/scale;doc.dispatchEvent(new Event('focusin'));
 assert.ok(Math.abs(Number.parseFloat(values.get('--app-visible-height'))*scale-450)<0.001,'market keyboard shrinks shell');
 doc.activeElement=new Element();
}
marketShell=false;win.innerWidth=402;win.innerHeight=812;vv.scale=1;vv.height=812;
win.dispatchEvent(new Event('spz-viewport-recover'));
assert.equal(values.get('--app-visible-height'),'874px','leaving market preserves existing SpielzeitApp recovery');
assert.equal(height({...pageZoom,safeAreaTop:0}),null);
assert.ok(height({...pageZoom,safeAreaTop:62})>1028);
ctx.cleanup();
console.log('PASS: exact 85% N7 report, 50–200% page zoom, first-load CSS vars, nav physical gap, keyboard, resume, delayed measures and actual pinch isolation; Safari/Android/split-screen excluded.');
