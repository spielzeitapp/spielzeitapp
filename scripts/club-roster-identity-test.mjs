import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
let requests=[];const profile={id:'existing',first_name:'Theo',last_name:'Putz',external_ids:['123456'],memberships:[{id:'u12',label:'Rohrbach U12'}]};
globalThis.__clubIdentityRpc=async(name,args)=>{requests.push({name,args});return {data:name==='admin_club_roster_context'?[profile]:'existing',error:null};};
const compile=async entry=>{const built=await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'mock',setup(api){api.onResolve({filter:/supabaseClient$/},()=>({path:'rpc',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const supabase={rpc:(...args)=>globalThis.__clubIdentityRpc(...args)}'}));}}]});const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);return mod.exports;};
const identity=await compile('src/lib/clubRosterIdentity.ts');
assert.equal(identity.rosterIdentityMatches([profile],' THEO ','putz').length,1);
assert.equal(identity.rosterIdentityMatches([profile],'Different','Name','123456')[0].id,'existing');
assert.equal(identity.rosterIdentityMatches([profile],'Other','Person').length,0);
const {ManagerNewRosterPlayer}=await compile('src/manager/ManagerNewRosterPlayer.tsx');const oldWindow=globalThis.window;globalThis.window={dispatchEvent:()=>{}};let saved=0,root;
async function change(index,value){await act(async()=>root.root.findAllByType('input')[index].props.onChange({target:{value}}));}
async function submit(){await act(async()=>{await root.root.findByType('form').props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));});}
try {
 await act(async()=>{root=create(React.createElement(ManagerNewRosterPlayer,{seasonId:'u13',onSaved:()=>saved++}));});
 await change(0,'Theo');await change(1,'Putz');await submit();
 assert.equal(requests.filter(r=>r.name==='admin_save_club_roster_player').length,0,'same name requires confirmation');
 assert.ok(JSON.stringify(root.toJSON()).includes('Rohrbach U12'));
 await act(async()=>root.root.findAllByType('input').find(x=>x.props.type==='radio').props.onChange());
 await submit();assert.equal(saved,0,'radio without identity confirmation cannot save');
 await act(async()=>root.root.findAllByType('input').find(x=>x.props.type==='checkbox').props.onChange({target:{checked:true}}));
 await submit();assert.equal(saved,1);assert.equal(requests.at(-1).args.p_player.player_id,'existing');assert.equal(requests.at(-1).args.p_team_season_id,'u13');
 console.log('PASS: normalized name/ÖFB matching, source team shown, no mutation before explicit approval, scoped profile reuse.');
}finally{await act(async()=>root.unmount());globalThis.window=oldWindow;delete globalThis.__clubIdentityRpc;}
