import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const React=require('react');const {create,act}=require('react-test-renderer');
const colors=new Map();const oldDocument=globalThis.document;
globalThis.document={documentElement:{dataset:{},style:{setProperty:(key,value)=>colors.set(key,value)}}};
const melk='22222222-2222-4222-8222-222222222222',rohrbach='11111111-1111-4111-8111-111111111111';
const blue={primary_color:'#164A9D',accent_color:'#F5C400',secondary_color:'#FFDA24'};
const red={primary_color:'#111114',accent_color:'#C82333',secondary_color:'#FFFFFF'};
let queries=[];
globalThis.__themeScope={selectedTeamSeasonId:rohrbach,viewTeamSeasonId:rohrbach,teamViewFilter:[melk],filteredTeamSeasonIds:[melk]};
globalThis.__themeLocation={pathname:'/app/team',search:''};
globalThis.__themeLoad=async id=>{queries.push(id);return {data:id===melk?blue:red,error:null};};
const compiled=await build({entryPoints:['src/theme/ClubThemeProvider.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'theme-fixtures',setup(api){
 api.onResolve({filter:/auth\/useSession$/},()=>({path:'session',namespace:'fixture'}));
 api.onResolve({filter:/^react-router-dom$/},()=>({path:'router',namespace:'fixture'}));
 api.onResolve({filter:/lib\/clubBranding$/},()=>({path:'branding',namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:path==='session'?'export const useSession=()=>globalThis.__themeScope;':path==='router'?'export const useLocation=()=>globalThis.__themeLocation;':`export const getClubBrandingForTeamSeason=id=>globalThis.__themeLoad(id);export const hexToRgbChannels=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(' ');export const readableTextColor=()=> '#fff';export const readableAccentOnDark=hexToRgbChannels;`}));
}}]});
const mod={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
const {ClubThemeProvider}=mod.exports;let root;
async function render(override){await act(async()=>{const node=React.createElement(ClubThemeProvider,{brandingOverride:override},React.createElement('span',null,'App'));if(root)root.update(node);else root=create(node);await new Promise(r=>setImmediate(r));});}
try{
 await render();assert.equal(queries.at(-1),melk,'single favorite overrides stale trainer metadata');assert.equal(colors.get('--club-accent-rgb'),'245 196 0');
 assert.equal(document.documentElement.dataset.clubWelcomeKit,'blue-yellow');
 const count=queries.length;globalThis.__themeLocation={pathname:'/app/mehr',search:''};await render();assert.equal(queries.length,count,'page navigation must not refetch/reset the same club');
 globalThis.__themeScope={...globalThis.__themeScope,teamViewFilter:null,viewTeamSeasonId:melk};await render();assert.equal(colors.get('--club-primary-rgb'),'22 74 157','read ID needs no metadata to theme external team');
 globalThis.__themeScope={...globalThis.__themeScope,viewTeamSeasonId:rohrbach};await render();assert.equal(colors.get('--club-accent-rgb'),'200 35 51');
 globalThis.__themeLocation={pathname:'/app/team',search:'?teamSeason='+melk};await render();assert.equal(colors.get('--club-accent-rgb'),'245 196 0','explicit team page uses the viewed team');
 await render(red);assert.equal(colors.get('--club-accent-rgb'),'200 35 51','unsaved manager preview override remains isolated and takes precedence');
 console.log('PASS: selected favorite/read/route IDs, missing metadata, navigation stability, Rohrbach return, blue-yellow artwork and manager override.');
}finally{if(root)await act(async()=>root.unmount());globalThis.document=oldDocument;delete globalThis.__themeScope;delete globalThis.__themeLocation;delete globalThis.__themeLoad;}
