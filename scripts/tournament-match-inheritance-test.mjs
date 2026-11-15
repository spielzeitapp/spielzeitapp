import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url),dir=mkdtempSync(join(tmpdir(),'tournament-inherit-'));
try {
const file=join(dir,'test.cjs');
await require('esbuild').build({entryPoints:['src/lib/tournamentLineupTemplates.ts'],bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent',plugins:[{name:'fixture',setup(b){
b.onResolve({filter:/supabaseClient$|tournamentSquad$|demoTournamentState$/},a=>({path:a.path.split('/').pop(),namespace:'stub'}));
b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'js',contents:a.path==='supabaseClient'?`
export const supabase={from(table){const q={select(){return q},eq(k,v){q.id=v;return q},async maybeSingle(){if(table==='tournament_lineup_templates')return {data:globalThis.fixture.record};return {data:globalThis.fixture.matches[q.id]};},async limit(){return {data:table==='match_lineup' ? (globalThis.fixture.lineups[q.id]||[]) : table==='match_bench' ? (globalThis.fixture.benches?.[q.id]||[]) : (globalThis.fixture.events?.[q.id]||[])}}};return q},async rpc(name,args){globalThis.fixture.calls.push(args);return {error:null}}};
`:a.path==='tournamentSquad'?`export async function fetchTournamentEventIdForMatch(id){return id==='normal'?null:'event'}`:`export const isDemoTournamentEventId=()=>false;`}));
}}]});
globalThis.window={localStorage:{setItem(){}}};
const lib=require(file);
const slots={GK:'p1',LB:'p2',RB:'p3',CM:'p4',LW:'p5',RW:'p6',ST:null,FP:null};
const block={formationId:'1-2-1-2',slots,squadIds:Array.from({length:12},(_,i)=>'p'+(i+1))};
globalThis.fixture={record:{blocks:{version:1,startVariant:1,variants:{1:block,2:block}},updated_at:'stamp'},matches:{empty:{status:'upcoming'},prepared:{status:'upcoming'},running:{status:'live'},done:{status:'finished'},inherited:{status:'upcoming',tournament_lineup_blocks:{version:1}}},lineups:{prepared:[{player_id:'old'}]},calls:[]};
await Promise.all([lib.prepareTournamentMatchFromTemplate('empty'),lib.prepareTournamentMatchFromTemplate('empty')]);
assert.equal(fixture.calls.length,1);
assert.equal(fixture.calls[0].p_match,'empty');
assert.equal(fixture.record.blocks.variants[1].formationId,'1-2-1-2');
for(const id of ['normal','prepared','running','done','inherited'])await lib.prepareTournamentMatchFromTemplate(id);
assert.equal(fixture.calls.length,1,'ordinary, prepared, live, finished and already inherited games must remain untouched');
assert.equal((await lib.prepareTournamentMatchFromTemplate('prepared')).blocks.variants[1].formationId,'1-2-1-2','prepared games still receive template for explicit restore UI');
fixture.benches={empty:[{player_id:'p1'}]};
await lib.prepareTournamentMatchFromTemplate('empty');
assert.equal(fixture.calls.length,1,'a deliberately reduced roster must not be reset');
fixture.benches={};fixture.events={empty:[{id:'event'}]};
await lib.prepareTournamentMatchFromTemplate('empty');
assert.equal(fixture.calls.length,1,'existing events must be preserved');
fixture.events={};
fixture.record.blocks.variants[1].slots.RW=null;
await lib.prepareTournamentMatchFromTemplate('empty');
assert.equal(fixture.calls.length,1,'incomplete template cannot be auto-applied');
console.log('PASS empty match inherits once; existing/started/finished/ordinary matches untouched; 5+1 template remains available for explicit restore; incomplete plans skipped');
} finally {rmSync(dir,{recursive:true,force:true});}
