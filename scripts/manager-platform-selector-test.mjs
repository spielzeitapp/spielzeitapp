import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url), React=require('react'), Test=require('react-test-renderer');
const folder=await mkdtemp(path.join(os.tmpdir(),'manager-selector-'));
try{
 await build({entryPoints:['src/manager/components/ManagerPlatformContextSelect.tsx'],outfile:path.join(folder,'selector.cjs'),bundle:true,platform:'node',format:'cjs',external:['react','react-router-dom'],plugins:[{name:'mock',setup(b){b.onResolve({filter:/platformClubAdmin/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const listPlatformClubs=async()=>({data:[{id:'nsg',name:'NSG Gölsental'},{id:'melk',name:'SC Melk'}]});export const getPlatformClub=async id=>({data:{id,team_seasons:id==='nsg'?[{id:'u12',team_name:'SPG Rohrbach',age_group:'U12',season_name:'2026/27'},{id:'u13',team_name:'SPG Rohrbach',age_group:'U13',season_name:'2026/27'}]:[{id:'m16',team_name:'SC Melk',age_group:'U16',season_name:'2026/27'}]}});`,loader:'js'}));}}]});
 const Module=require('node:module'),original=Module._resolveFilename;
 const resolved={'react':require.resolve('react'),'react/jsx-runtime':require.resolve('react/jsx-runtime'),'react-router-dom':require.resolve('react-router-dom')};
 Module._resolveFilename=function(request,...args){return resolved[request]||original.call(this,request,...args)};
 const {ManagerPlatformContextSelect}=require(path.join(folder,'selector.cjs'));Module._resolveFilename=original;
 const {MemoryRouter,useLocation}=require('react-router-dom');
 function Probe(){const l=useLocation();return React.createElement('output',null,l.pathname+l.search);}
 let tree;await Test.act(async()=>{tree=Test.create(React.createElement(MemoryRouter,{initialEntries:['/manager/vereine/nsg?setupSeason=u13']},React.createElement(ManagerPlatformContextSelect),React.createElement(Probe)));});
 const club=()=>tree.root.findByProps({'aria-label':'Verein wählen'}),season=()=>tree.root.findByProps({'aria-label':'Mannschaft und Saison wählen'});
 assert.equal(club().props.value,'nsg');assert.equal(season().props.value,'u13');
 await Test.act(async()=>season().props.onChange({target:{value:'u12'}}));assert.ok(tree.root.findByType('output').children.join('').includes('setupSeason=u12'));
 await Test.act(async()=>club().props.onChange({target:{value:'melk'}}));assert.equal(club().props.value,'melk');assert.equal(season().props.value,'');
 assert.equal(season().findAllByType('option').some(o=>o.props.value==='u12'),false,'Previous club team is not offered');
 await Test.act(async()=>season().props.onChange({target:{value:'m16'}}));assert.ok(tree.root.findByType('output').children.join('').includes('/manager/vereine/melk?setupSeason=m16'));
 await Test.act(async()=>tree.unmount());console.log('PASS platform selector: route club and team, dependent options and navigation.');
}finally{await rm(folder,{recursive:true,force:true});}
