import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer'),Module=require('module');
const fixture=globalThis.marketSwitchFixture={user:{id:'a'},session:{user:{id:'a'},loading:false,backendRole:'',previewRole:null,memberships:[],membershipError:null},pending:[]};
const built=await build({stdin:{contents:"export {useMarketAppSwitch} from './src/features/club/useMarketAppSwitch';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'cjs',platform:'node',packages:'external',write:false,plugins:[{name:'session',setup(b){b.onResolve({filter:/AuthProvider$/},()=>({path:'auth',namespace:'fixture'}));b.onResolve({filter:/useSession$/},()=>({path:'session',namespace:'fixture'}));b.onResolve({filter:/pushOnboardingGate$/},()=>({path:'gate',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='auth'?'export const useAuth=()=>({user:globalThis.marketSwitchFixture.user});':a.path==='session'?'export const useSession=()=>globalThis.marketSwitchFixture.session;':'export const isUserOnboardingComplete=()=>new Promise((resolve,reject)=>globalThis.marketSwitchFixture.pending.push({resolve,reject}));'}));}}]});
const m=new Module('switch-test');m.paths=require.resolve.paths('react');m._compile(built.outputFiles[0].text,'switch-test');
function View(){return React.createElement('span',null,m.exports.useMarketAppSwitch()?'visible':'hidden')}
let app;const render=()=>act(async()=>{if(app)app.update(React.createElement(View));else app=create(React.createElement(View))});const visible=()=>app.toJSON().children[0];
await render();assert.equal(visible(),'hidden');const old=fixture.pending.shift();
fixture.user={id:'b'};fixture.session={...fixture.session,user:{id:'b'}};await render();const current=fixture.pending.shift();await act(async()=>old.resolve(true));assert.equal(visible(),'hidden','old account result must not reveal the switch');await act(async()=>current.resolve(false));assert.equal(visible(),'hidden');
fixture.session={...fixture.session,memberships:[{role:'parent',team_season_id:'team'}]};await render();await act(async()=>fixture.pending.shift().resolve(true));assert.equal(visible(),'visible');
fixture.session={...fixture.session,loading:true};await render();assert.equal(visible(),'hidden');
fixture.session={...fixture.session,loading:false,membershipError:'unavailable'};await render();assert.equal(visible(),'hidden');assert.equal(fixture.pending.length,0);
fixture.session={...fixture.session,membershipError:null};await render();await act(async()=>fixture.pending.shift().reject(new Error('unavailable')));assert.equal(visible(),'hidden');
fixture.user=null;await render();assert.equal(visible(),'hidden');await act(async()=>app.unmount());
console.log('PASS: stale account checks ignored, market-only account hidden, configured account visible, loading/error/logout hide shortcut');
