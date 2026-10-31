import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require=createRequire(import.meta.url);
const React=require('react'); const {create,act}=require('react-test-renderer');
let calls=[],responses=[],done=[];
globalThis.__rosterActionRpc=async(name,args)=>{calls.push({name,args});return await responses.shift();};
const compiled=await build({entryPoints:['src/manager/ManagerRosterPlayerActions.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,
 plugins:[{name:'rpc-fixture',setup(api){api.onResolve({filter:/supabaseClient$/},()=>({path:'rpc',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const supabase={rpc:(...args)=>globalThis.__rosterActionRpc(...args)};'}));}}]});
const mod={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
const oldWindow=globalThis.window;globalThis.window={dispatchEvent:()=>{}};
let root; const props={seasonId:'synthetic-season',playerId:'synthetic-player',name:'Testspieler',removed:false,onDone:(...args)=>done.push(args)};
const button=text=>root.root.findAllByType('button').find(x=>x.children.join('')===text);
async function click(text){await act(async()=>{button(text).props.onClick();await new Promise(r=>setImmediate(r));});}
try {
 await act(async()=>{root=create(React.createElement(mod.exports.ManagerRosterPlayerActions,props));});
 await click('Spieler löschen');assert.equal(calls.length,0,'opening confirmation must not mutate');
 await click('Abbrechen');assert.equal(calls.length,0,'cancelling must not mutate');
 await click('Aus Kader entfernen');responses.push({data:{ok:true},error:null});await click('Entfernen bestätigen');
 assert.deepEqual(calls[0],{name:'admin_roster_player_action',args:{p_team_season_id:props.seasonId,p_player_id:props.playerId,p_action:'remove'}});
 assert.equal(done.at(-1)[1],false);
 await click('Spieler löschen');responses.push({data:null,error:{message:'Spieler wird bereits verwendet.'}});await click('Endgültig löschen');
 assert.deepEqual(done.at(-1),['Spieler wird bereits verwendet.',true]);
 // Disable duplicate submits and ignore late callbacks after navigation/unmount.
 let resolve;responses.push(new Promise(r=>{resolve=r;}));await click('Spieler löschen');
 await act(async()=>{const fn=button('Endgültig löschen').props.onClick;fn();fn();});
 assert.equal(calls.length,3);assert.equal(button('Wird gespeichert…').props.disabled,true);
 const previous=done.length;await act(async()=>root.unmount());await act(async()=>resolve({data:{ok:true},error:null}));assert.equal(done.length,previous);
 await act(async()=>{root=create(React.createElement(mod.exports.ManagerRosterPlayerActions,{...props,removed:true}));});
 assert.equal(button('Aus Kader entfernen'),undefined,'archived membership cannot be removed twice');assert.ok(button('Spieler löschen'));
 console.log('PASS: confirmation/cancel, scoped RPC, guarded errors, duplicate submit, unmount, archived row.');
} finally {if(root)await act(async()=>root.unmount());globalThis.window=oldWindow;delete globalThis.__rosterActionRpc;}
