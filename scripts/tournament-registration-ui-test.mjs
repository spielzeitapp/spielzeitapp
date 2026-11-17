import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {build} from 'esbuild';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
const require=createRequire(import.meta.url);
const token='a'.repeat(64),sid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const roster=[{id,firstName:'Test',lastName:'Spieler',birthYear:2015,number:7}];let revision=0,saves=[];
const rpc=async(_,{p_action:a,p_args:p})=>{
 let data;
 if(a==='open')data={id,eventId:id,teamName:'TEST U12',teams:[{id:sid,name:'Testverein',ageGroup:'U12',season:'2026/27'}],revision,status:'invited',sourceTeamSeasonId:null,contactName:'',contactPhone:'',jerseyColors:'',players:[]};
 if(a==='roster')data=roster;
 if(a==='save'){saves.push(p);data={revision:++revision}}
 if(a==='list')data=[{participantId:id,id,teamName:'TEST U12',status:'submitted',revision:1,players:roster}];
 if(a==='confirm')data={ok:true};
 return {data,error:null};
};
const bundle=await build({entryPoints:['src/features/tournamentRegistration/RegistrationPage.tsx','src/features/tournamentRegistration/AdminPage.tsx'],bundle:true,write:false,outdir:'tmp',format:'cjs',external:['react'],define:{'import.meta.env.DEV':'true'},plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/AuthProvider|supabaseClient|appEnvironment|react-router-dom$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.includes('AuthProvider')?'export const useAuth=()=>({user:{id:"test-user"},loading:false});':a.path.includes('supabaseClient')?'export const supabase=globalThis.fixtureSupabase;':a.path.includes('appEnvironment')?'export const isStagingApp=()=>true;':`import React from 'react';export const useParams=()=>({token:'${token}',eventId:'${id}'});export const useLocation=()=>({pathname:'/turnier-verwaltung/${id}'});export const Link=({to,children,...p})=>React.createElement('a',{href:to,...p},children);`,loader:'jsx'}));
}}]});
function evaluate(file){const context={exports:{},require,console,setTimeout,clearTimeout,fixtureSupabase:{rpc},window:{location:{origin:'https://test.example.invalid',reload(){}}}};context.module={exports:context.exports};context.globalThis=context;vm.runInNewContext(file.text,context);return context.module.exports;}
const {TournamentRegistrationPage}=evaluate(bundle.outputFiles.find(f=>f.path.endsWith('RegistrationPage.js')));
let tree;await act(async()=>{tree=Renderer.create(React.createElement(TournamentRegistrationPage))});
const button=text=>tree.root.findAllByType('button').find(b=>b.children.join('')===text);
const inputs=()=>tree.root.findAllByType('input');
await act(async()=>tree.root.findByType('select').props.onChange({target:{value:sid}}));
await act(async()=>{inputs()[0].props.onChange({target:{value:'Testtrainer'}});inputs()[2].props.onChange({target:{value:'Rot / Schwarz'}})});
await act(async()=>button('Weiter zu Spielern').props.onClick());
await act(async()=>button('Gesamten aktiven Kader auswählen').props.onClick());
await act(async()=>button('Weiter zur Prüfung').props.onClick());
await act(async()=>inputs().find(i=>i.props.type==='checkbox').props.onChange({target:{checked:true}}));
await act(async()=>button('Meldung einreichen').props.onClick());
assert.equal(saves.length,1);assert.equal(saves[0].players[0].id,id);assert.equal(saves[0].players[0].number,'7');assert.equal(saves[0].submit,true);assert.equal(saves[0].authorized,true);
assert.match(JSON.stringify(tree.toJSON()),/Meldung eingereicht/);await act(async()=>tree.unmount());
const {TournamentRegistrationAdminPage}=evaluate(bundle.outputFiles.find(f=>f.path.endsWith('AdminPage.js')));
await act(async()=>{tree=Renderer.create(React.createElement(TournamentRegistrationAdminPage))});
assert.ok(button('Meldung bestätigen'));await act(async()=>button('Meldung bestätigen').props.onClick());await act(async()=>tree.unmount());
console.log('Registration UI: team selection, roster import, number, submission and organizer confirmation passed.');
