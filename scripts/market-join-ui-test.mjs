import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),renderer=require('react-test-renderer'),{MemoryRouter,useLocation}=require('react-router-dom');
const state=globalThis.marketJoinTest={user:null,calls:[],error:null,joined:0};
const built=await build({entryPoints:['src/features/club/MarketJoinPanel.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/AuthProvider$/},()=>({path:'auth',namespace:'mock'}));b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='auth'?"export const useAuth=()=>({user:globalThis.marketJoinTest.user});":"export const supabase={rpc:async(name,args)=>{globalThis.marketJoinTest.calls.push({name,args});return {data:true,error:globalThis.marketJoinTest.error}}};",loader:'js'}));
}}]});
const Module=require('module'),mod=new Module('join-ui.cjs');mod.paths=require.resolve.paths('react');mod._compile(built.outputFiles[0].text,'join-ui.cjs');const {MarketJoinPanel,marketInviteToken}=mod.exports;
const club='9c7a8741-6e73-42d5-88d8-46ce5217e8cd',token='a'.repeat(64);let app;
const Watch=()=>React.createElement('output',null,useLocation().search);
async function mount(query){await renderer.act(async()=>{app=renderer.create(React.createElement(MemoryRouter,{initialEntries:[`/marktplatz/${club}?${query}`],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(React.Fragment,null,React.createElement(MarketJoinPanel,{clubId:club,clubName:'NSG Gölsental',onJoined:()=>state.joined++}),React.createElement(Watch))));});}
const unmount=async()=>renderer.act(async()=>app.unmount());
assert.equal(marketInviteToken(token),token);for(const t of [null,'bad','A'.repeat(64),token+'x'])assert.equal(marketInviteToken(t),'');
await mount(`view=member&mode=create&invite=${token}`);
for(const a of app.root.findAllByType('a')){const u=new URL(a.props.href,'https://test');assert.ok(u.pathname.endsWith('/registrieren')||u.pathname.endsWith('/anmelden'));const next=new URL(u.searchParams.get('next'),'https://test');assert.equal(next.searchParams.get('invite'),token);assert.equal(next.searchParams.get('mode'),'create');assert.equal(next.pathname,`/marktplatz/${club}`);}
assert.equal(state.calls.length,0,'guest does not join');await unmount();
state.user={id:'new-parent'};await mount(`view=member&mode=create&invite=${token}`);
let button=()=>app.root.findByType('button');assert.equal(button().props.disabled,true);
await renderer.act(async()=>button().props.onClick());assert.equal(state.calls.length,0,'no join without explicit acceptance');
await renderer.act(async()=>app.root.findByType('input').props.onChange({target:{checked:true}}));
state.error={message:'Einladung abgelaufen'};await renderer.act(async()=>button().props.onClick());assert.equal(state.joined,0);assert.ok(app.root.findByProps({role:'alert'}).children.includes('Einladung abgelaufen'));assert.ok(app.root.findByType('output').children.join('').includes('invite='));
state.error=null;await renderer.act(async()=>button().props.onClick());assert.equal(state.joined,1);assert.deepEqual(state.calls.at(-1),{name:'exchange_join',args:{p_club_id:club,p_token:token,p_accepted:true}});
const q=new URLSearchParams(app.root.findByType('output').children.join(''));assert.equal(q.has('invite'),false);assert.equal(q.get('view'),'member');assert.equal(q.get('mode'),'create');await unmount();
await mount('view=member');assert.equal(app.root.findAllByType('button').length,0);assert.ok(JSON.stringify(app.toJSON()).includes('Einladungslink'));await unmount();delete globalThis.marketJoinTest;
console.log('PASS: guest registration/login retain invitation and intended action; consent required; failure retry; join returns to market and removes token; missing invitation explained.');
