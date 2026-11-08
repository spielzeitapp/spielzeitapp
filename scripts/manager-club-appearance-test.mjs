import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require=createRequire(import.meta.url);
async function compile(path,plugins=[]){const built=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins});const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);return mod.exports;}
const palette=await compile('src/manager/appearance/clubAppearance.ts');
for(const [primary,secondary,accent] of [['#111114','#FFFFFF','#E6E8EB'],['#164A9D','#F5C400','#F5C400'],['#C82333','#111114','#C82333'],['#FFFFFF','#FFFFFF','#FFFFFF'],['#000000','#000000','#000000']]){
 for(const mode of ['day','night']){const c=palette.clubAppearance(primary,secondary,accent,mode);assert.equal(c.primary,primary);assert.equal(c.secondary,secondary);assert.equal(c.accent,accent);assert.ok(palette.contrast(c.accent,c.onAccent)>=4.5,'filled actions remain legible');assert.ok(palette.contrast(c.link,mode==='day'?'#FFFFFF':'#202127')>=4.5,'links remain legible');}
}
assert.equal(palette.parseAppearance('day'),'day');assert.equal(palette.parseAppearance('broken'),'night');
assert.equal(palette.brandColor('url(evil)','#202126'),'#202126');
const React=require('react'),{create,act}=require('react-test-renderer');
const oldWindow=globalThis.window,oldStorage=globalThis.localStorage;
const events=new Map(),stored=new Map(),queries=[];
globalThis.window={addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
globalThis.__appearanceSession={selectedTeamSeasonId:'rohrbach',viewTeamSeasonId:null,selectedTeamSeason:{team:{name:'Rohrbach'}},viewTeamSeason:null};
globalThis.__appearanceWork={workMode:'trainer',supportSession:null};
globalThis.__appearanceLocation={pathname:'/manager'};
let pending;
globalThis.__appearanceLoad=async(scope)=>{queries.push(scope);if(scope==='club:slow')return new Promise(resolve=>{pending=resolve});return {data:{logo_url:null,primary_color:scope.includes('melk')?'#164A9D':'#111114',secondary_color:'#FFFFFF',accent_color:scope.includes('melk')?'#F5C400':'#E6E8EB'},error:null};};
const mod=await compile('src/manager/appearance/ManagerAppearance.tsx',[{name:'appearance-fixtures',setup(api){
 api.onResolve({filter:/auth\/useSession$/},()=>({path:'session',namespace:'fixture'}));
 api.onResolve({filter:/ManagerWorkModeContext$/},()=>({path:'work',namespace:'fixture'}));
 api.onResolve({filter:/^react-router-dom$/},()=>({path:'router',namespace:'fixture'}));
 api.onResolve({filter:/lib\/clubBranding$/},()=>({path:'branding',namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:({session:'export const useSession=()=>globalThis.__appearanceSession;',work:'export const useManagerWorkMode=()=>globalThis.__appearanceWork;',router:'export const useLocation=()=>globalThis.__appearanceLocation;',branding:`export const getClubBranding=id=>globalThis.__appearanceLoad('club:'+id);export const getClubBrandingForTeamSeason=id=>globalThis.__appearanceLoad('team:'+id);`})[path]}));
}}]);
let root;async function render(){await act(async()=>{const el=React.createElement(mod.ManagerAppearance,null,React.createElement(mod.ManagerAppearanceToggle));if(root)root.update(el);else root=create(el);await new Promise(r=>setImmediate(r));});}
const shell=()=>root.root.findByProps({className:'manager-shell manager-club-workspace flex min-h-[100dvh] w-full min-w-0 flex-1 max-md:h-[100dvh] max-md:overflow-hidden'});
try {
 await render();assert.equal(queries.at(-1),'team:rohrbach');assert.equal(shell().props['data-manager-appearance'],'night');
 await act(async()=>root.root.findByType('button').props.onClick());assert.equal(shell().props['data-manager-appearance'],'day');assert.equal(stored.get(palette.APPEARANCE_KEY),'day');
 globalThis.__appearanceSession.viewTeamSeasonId='melk';await render();assert.equal(shell().props.style['--manager-action'],'#F5C400');
 globalThis.__appearanceWork={workMode:'platform_admin',supportSession:null};globalThis.__appearanceLocation={pathname:'/manager/vereine/slow'};await render();assert.notEqual(shell().props.style['--manager-action'],'#F5C400','old club clears while next request is pending');
 globalThis.__appearanceLocation={pathname:'/manager/vereine/melk'};await render();assert.equal(queries.at(-1),'club:melk','platform route is authoritative over stale trainer season');
 await act(async()=>pending({data:{accent_color:'#000000'},error:null}));assert.equal(shell().props.style['--manager-action'],'#F5C400','late old request cannot replace current club');
 const n=queries.length;await act(async()=>{events.get('spielzeit:club-branding-changed')();await new Promise(r=>setImmediate(r));});assert.equal(queries.length,n+1,'saving branding refreshes the same workspace');
 globalThis.__appearanceLocation={pathname:'/manager/plattform'};await render();assert.equal(shell().props['data-manager-club'],'platform');assert.equal(shell().props.style['--manager-action'],'#D9232C','global platform has no previous club theme');
 globalThis.__appearanceWork={workMode:'club_admin',supportSession:{clubId:'melk',clubName:'SC Melk'}};await render();assert.equal(shell().props['data-manager-club'],'club:melk');
 console.log('PASS: club palettes and 4.5:1 contrast in day/night; saved preference, club/team/support scope, platform reset, stale requests and branding refresh.');
} finally {if(root)await act(async()=>root.unmount());globalThis.window=oldWindow;globalThis.localStorage=oldStorage;for(const k of ['__appearanceSession','__appearanceWork','__appearanceLocation','__appearanceLoad'])delete globalThis[k];}
