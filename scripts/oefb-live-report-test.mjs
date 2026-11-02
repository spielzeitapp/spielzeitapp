import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
let queries=0,fetches=0;
globalThis.__oefbFrom=()=>{queries++;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{external_id:'123'},error:null})};return q;};
const report={id:'123',home:'Home',away:'Away',score:'1:0',homePlayers:[{name:'Starter Name',number:'7'}],awayPlayers:[{name:'Other Name',number:'2'}],events:[{type:'goal',minute:54,side:'home',player:'Scorer',score:'1:0'},{type:'playerchange',minute:60,side:'away',player:'In',secondPlayer:'Out'},{type:'card-blue',minute:63,side:'home',player:'Card'}]};
globalThis.fetch=async()=>{fetches++;return {ok:true,json:async()=>report};};
const b=await build({entryPoints:['src/components/match/OefbLiveReport.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'db',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase={from:(...a)=>globalThis.__oefbFrom(...a)}'}));}}]});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);
const {OefbLiveReport,useOefbLiveReport}=m.exports;
for(const [filter,count] of [['all',3],['goals',1],['subs',1],['cards',1]]){let r;await act(async()=>{r=create(React.createElement(OefbLiveReport,{report,view:'events',filter}));});assert.equal(r.root.findAllByType('li').length,count);assert.ok(JSON.stringify(r.toJSON()).includes('Quelle: ÖFB'));await act(async()=>r.unmount());}
let r;await act(async()=>{r=create(React.createElement(OefbLiveReport,{report,view:'lineup'}));});assert.equal(r.root.findAllByType('li').length,2);assert.ok(JSON.stringify(r.toJSON()).includes('Starter Name'));await act(async()=>r.unmount());
function Hook({enabled,id}){const s=useOefbLiveReport(id,enabled);return React.createElement('p',null,s.report?.score??'none');}
await act(async()=>{r=create(React.createElement(Hook,{id:'m',enabled:false}));});assert.equal(queries,0);assert.equal(fetches,0);
await act(async()=>r.update(React.createElement(Hook,{id:'m',enabled:true})));assert.equal(fetches,1);assert.equal(r.root.findByType('p').children[0],'1:0');
await act(async()=>r.update(React.createElement(Hook,{id:'other',enabled:false})));assert.equal(r.root.findByType('p').children[0],'none');await act(async()=>r.unmount());
console.log('PASS: native source ticker filters including blue cards, both lineups, finished-only opt-in fetching, match-switch isolation; no writes.');
