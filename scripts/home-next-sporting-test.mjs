import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const compiled=await build({entryPoints:['src/features/home/homeFeedBuilder.ts'],bundle:true,write:false,format:'cjs'});
const context={module:{exports:{}},console,Date,Intl};
vm.runInNewContext(compiled.outputFiles[0].text,context);
const pick=context.module.exports.pickHomeSportingCard;
const now=new Date('2026-10-22T12:00:00Z');
const event=(id,date,extra={})=>({id,kind:'match',status:'upcoming',starts_at:date,fixture_status:'published',match_id:id,...extra});
const alpen=event('alpen','2026-10-25T10:30:00Z');
const turnier=event('wilhelmsburg','2026-11-27T16:00:00Z',{kind:'tournament',match_id:null});
const past=event('old-tournament','2026-08-15T08:00:00Z',{kind:'tournament'});
assert.equal(pick([turnier,past,alpen],now).event.id,'alpen');
assert.equal(pick([turnier,alpen],now,new Set(['alpen'])).event.id,'alpen','deleted autopost must not hide next fixture');
assert.equal(pick([past],now),null,'no fallback to expired upcoming event');
assert.equal(pick([turnier],now).event.id,'wilhelmsburg','future tournament is still selectable');
assert.equal(pick([event('done','2026-10-22T08:00:00Z',{kind:'tournament',tournament_completed_at:'2026-10-22T10:00:00Z'}),alpen],now).event.id,'alpen');
assert.equal(pick([event('finished','2026-10-22T08:00:00Z',{status:'finished'}),alpen],now).event.id,'alpen');
assert.equal(pick([event('internal','2026-10-23T08:00:00Z',{fixture_status:'open'}),alpen],now).event.id,'alpen');
assert.equal(pick([event('bad','invalid'),alpen],now).event.id,'alpen');
assert.equal(pick([event('tomorrow','2026-10-22T22:30:00Z')],now).status,'tomorrow','Vienna calendar, not UTC day');

// Render the actual hook with controlled request completion order.
let slots=[],cursor=0,effects=[],pendingEffects=[];
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const react={
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
 useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
 useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
 useEffect(fn,deps){const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps)){const previous=effects[i];effects[i]={deps};pendingEffects.push(()=>{previous?.cleanup?.();effects[i].cleanup=fn();});}},
};
let requests=[];
const db={from(){let season;const q={select(){return q;},eq(_,id){season=id;return q;},in(_,ids){season=ids.join(',');return q;},order(){return new Promise(resolve=>requests.push({season,resolve}));}};return q;}};
const hookBundle=await build({entryPoints:['src/hooks/useEvents.ts'],bundle:true,write:false,format:'cjs',plugins:[{name:'controlled-hooks',setup(b){
 b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'mock'}));
 b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='react'?'export const {useState,useRef,useCallback,useEffect}=globalThis.react;':'export const supabase=globalThis.db;'}));
}}]});
const hookCtx={module:{exports:{}},react,db,console};vm.runInNewContext(hookBundle.outputFiles[0].text,hookCtx);
function render(scope){cursor=0;const result=hookCtx.module.exports.useEvents(scope);const work=pendingEffects;pendingEffects=[];work.forEach(fn=>fn());return result;}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
assert.equal(render('A').loading,true);
render('B');assert.equal(render('B').events.length,0);
requests.find(r=>r.season==='B').resolve({data:[event('new','2026-10-25T10:30:00Z')],error:null});await flush();
assert.equal(render('B').events[0].id,'new');
requests.find(r=>r.season==='A').resolve({data:[event('old','2026-11-27T16:00:00Z')],error:null});await flush();
assert.equal(render('B').events[0].id,'new','late old-season response cannot overwrite current season');
let current=render('B');const refreshing=current.refetch();
assert.equal(render('B').events[0].id,'new','retain current card during refresh');
requests.at(-1).resolve({data:null,error:{message:'offline'}});await refreshing;
assert.equal(render('B').events[0].id,'new','retain current card on temporary refresh error');
assert.equal(render('C').events.length,0,'never show previous team while new scope loads');
assert.equal(render(null).events.length,0);
requests.at(-1).resolve({data:[event('late','2026-11-27T16:00:00Z')],error:null});await flush();
assert.equal(render(null).events.length,0,'logout ignores outstanding requests');
console.log('PASS: Alpenvorland precedes Wilhelmsburg regardless of autopost setting; completed, old, internal and invalid events excluded; timezone and event-request races verified.');
