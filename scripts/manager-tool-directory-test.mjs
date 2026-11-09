import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer'),{MemoryRouter}=require('react-router-dom');
const state={mode:'platform_admin',support:false,disabled:[],speaker:true,music:true};globalThis.__directory=state;
const result=await build({entryPoints:['src/manager/modern/ManagerToolDirectory.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'directory-fixtures',setup(api){
 for(const [filter,path] of [[/ManagerWorkModeContext$/,'work'],[/ManagerClubModulesContext$/,'modules'],[/CommunicationAccessContext$/,'communication'],[/appEnvironment$/,'env']])api.onResolve({filter},()=>({path,namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:{work:"export const useManagerWorkMode=()=>({workMode:globalThis.__directory.mode,supportSession:globalThis.__directory.support?{}:null});",modules:"export const useManagerClubModules=()=>({isModuleEnabled:key=>!globalThis.__directory.disabled.includes(key)});",communication:"export const useCommunicationAccess=()=>({access:globalThis.__directory});",env:'export const isStagingApp=()=>true;'}[path]}));
}}]});
const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
function app(){return React.createElement(MemoryRouter,{basename:'/vereinszentrale',initialEntries:['/vereinszentrale/manager/mehr'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(module.exports.ManagerToolDirectory,{fotoboxTo:'/manager/saisons/current/kader?fotobox=1'}));}
let tree;await act(async()=>{tree=create(app());});
const links=()=>tree.root.findAllByType('a').filter(a=>a.props.href.startsWith('/vereinszentrale/manager'));
for(const label of ['ÖFB-Import','Trainingsplanung','Übungsbibliothek','Spieler & Fotos','Fotobox','LIVE-Veröffentlichung','Trainingschronik','Wochenkalender']) assert.ok(links().some(a=>a.findAllByType('span').some(s=>s.children.includes(label))),label+' is accessible from the mobile directory');
assert.ok(tree.root.findAllByType('a').some(a=>a.props.href==='/manager/mehr'),'switch keeps the same original page');
assert.ok(links().some(a=>a.props.href==='/vereinszentrale/manager/saisons/current/kader?fotobox=1'),'direct Fotobox keeps its existing team context');
state.mode='trainer';state.disabled=['venues'];state.speaker=false;state.music=false;await act(async()=>tree.update(app()));
assert.ok(!links().some(a=>/live-veroeffentlichung|plattform|vereine|platzbelegung|sprecherstudio|musikstudio/.test(a.props.href)),'role and module exclusions match desktop');
assert.ok(links().some(a=>a.props.href.endsWith('/mehr/parent-access')));
await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'Freisteller'}}));assert.equal(links().length,1);assert.ok(links()[0].props.href.endsWith('/spieler'));
await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'not-a-manager-tool'}}));assert.ok(tree.root.findByProps({role:'status'}));
await act(async()=>tree.unmount());delete globalThis.__directory;
console.log('PASS: mobile directory exposes the real desktop catalogue, role/module filtering, original-page switching, aliases and empty search.');
