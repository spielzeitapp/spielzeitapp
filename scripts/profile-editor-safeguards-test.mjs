import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
async function load(path){const r=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});const m={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {draftHistoryReducer:reduce}=await load('src/manager/useDraftHistory.ts');let s={value:{x:1},past:[],group:false,recorded:false};s=reduce(s,{type:'begin'});for(let x=2;x<20;x++)s=reduce(s,{type:'change',update:{x}});s=reduce(s,{type:'end'});assert.equal(s.past.length,1);s=reduce(s,{type:'undo'});assert.equal(s.value.x,1,'Full drag is one undo');s=reduce(s,{type:'change',update:{x:7}});s=reduce(s,{type:'reset',value:{x:3}});assert.equal(s.past.length,0);
const {isClubProfileDesign,defaultClubProfileDesign}=await load('src/lib/clubProfileDesign.ts');assert.ok(isClubProfileDesign(defaultClubProfileDesign('wide')));assert.equal(isClubProfileDesign({name:{}}),false);
const {useUnsavedProfileGuard}=await load('src/manager/useUnsavedProfileGuard.ts');const {MemoryRouter,useNavigate,useLocation}=require('react-router-dom');const listeners=new Map();let allow=false,prompts=0,nav;
globalThis.window={addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k),confirm:()=>{prompts++;return allow;}};
function Probe({dirty}){useUnsavedProfileGuard(dirty);nav=useNavigate();return React.createElement('output',null,useLocation().pathname+useLocation().search);}
let tree;await act(async()=>tree=create(React.createElement(MemoryRouter,{initialEntries:['/club']},React.createElement(Probe,{dirty:true}))));
await act(async()=>nav('/other'));assert.equal(tree.root.findByType('output').children.join(''),'/club');assert.equal(prompts,1);
await act(async()=>nav('/club?season=u13'));assert.equal(prompts,1,'Same-club season switch keeps draft and does not warn');
allow=true;await act(async()=>nav('/other'));assert.equal(tree.root.findByType('output').children.join(''),'/other');
let prevented=false;const event={preventDefault(){prevented=true},returnValue:undefined};listeners.get('beforeunload')(event);assert.equal(prevented,true);assert.equal(event.returnValue,'');
await act(async()=>tree.update(React.createElement(MemoryRouter,{initialEntries:['/club']},React.createElement(Probe,{dirty:false}))));const count=prompts;await act(async()=>nav('/clean'));assert.equal(prompts,count,'Saved state does not warn');
await act(async()=>tree.unmount());assert.equal(listeners.has('beforeunload'),false);
console.log('PASS safeguards: grouped undo/reset, stored draft validation, internal navigation cancel/confirm, same-club navigation, browser unload and cleanup.');
