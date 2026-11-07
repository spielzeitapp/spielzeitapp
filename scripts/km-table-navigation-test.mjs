import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');let lookups=[];
globalThis.__kmSettings={competitionId:'',sourceUrl:'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/KM/Tabellen/',teamName:'Rohrbach/Gölsen'};
globalThis.__kmGetSettings=async id=>{lookups.push(id);return {data:globalThis.__kmSettings,error:null};};
const season=category=>({id:category,age_group:category,team:{name:'USC Rohrbach',age_group:category},season:{name:'2026/27'},status:'active'});
const session=category=>({user:{id:'fixture'},selectedTeamSeasonId:category,viewTeamSeasonId:null,teamSeasons:[season(category)],teamViewFilter:null,filteredTeamSeasonIds:[category],selectedTeamSeason:season(category),viewTeamSeason:null});
async function bundle(path){const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,define:{'import.meta.env.BASE_URL':'"/"'},plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/useSession$/},()=>({path:'session',namespace:'fixture'}));b.onResolve({filter:/oefbTableSettings$/},()=>({path:'settings',namespace:'fixture'}));b.onResolve({filter:/ManagerWorkModeContext$/},()=>({path:'work',namespace:'fixture'}));b.onResolve({filter:/OefbCompetition(Table|Results)$/},()=>({path:'table',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:path==='session'?'export const useSession=()=>globalThis.__kmSession':path==='settings'?'export const getOefbTableSettings=id=>globalThis.__kmGetSettings(id)':path==='work'?'export const useManagerWorkMode=()=>({supportSession:null})':'export const OefbCompetitionTable=()=>null; export const OefbCompetitionResults=()=>null;'}));
}}]});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {supportsLeagueTable}=await bundle('src/lib/leagueTableEligibility.ts');for(const c of ['KM','Kampfmannschaft','RES','Reserve','Frauen','U13','U16-FR','U23','U13 B'])assert.equal(supportsLeagueTable(c),true,c);for(const c of ['U7','U12','',null,'unknown','U123'])assert.equal(supportsLeagueTable(c),false,c);
const {CompetitionProvider,useCompetition}=await bundle('src/app/components/CompetitionContext.tsx');let value;function Probe(){value=useCompetition();return null;}
for(const category of ['KM','RES','U13','U12']){
 globalThis.__kmSession=session(category);lookups=[];let root;
 await act(async()=>{root=create(React.createElement(CompetitionProvider,null,React.createElement(Probe)));});
 assert.equal(Boolean(value.settings),category!=='U12',category);assert.deepEqual(lookups,category==='U12'?[]:[category]);if(category!=='U12')assert.equal(value.settings.teamName,'Rohrbach/Gölsen');await act(async()=>root.unmount());
}
globalThis.__kmSettings=null;globalThis.__kmSession=session('KM');let root;await act(async()=>{root=create(React.createElement(CompetitionProvider,null,React.createElement(Probe)));});assert.equal(value.settings,null,'No table link without saved settings');await act(async()=>root.unmount());
globalThis.__kmSettings={competitionId:'',sourceUrl:'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/KM/Tabellen/',teamName:'Rohrbach/Gölsen'};
const {ManagerCompetitionPage}=await bundle('src/manager/ManagerCompetitionPage.tsx');const {MemoryRouter}=require('react-router-dom');globalThis.__kmSession=session('KM');lookups=[];await act(async()=>{root=create(React.createElement(MemoryRouter,null,React.createElement(ManagerCompetitionPage)));});assert.deepEqual(lookups,['KM']);assert.ok(!JSON.stringify(root.toJSON()).includes('Keine ÖFB-Tabelle hinterlegt'));await act(async()=>root.unmount());
const bottom=readFileSync('src/app/components/BottomNav.tsx','utf8');assert.match(bottom,/competitionSettings\) return.*to: '\/app\/tabelle'/,'existing bottom navigation follows eligible saved settings');
console.log('PASS league eligibility, actual KM/Reserve/U13 provider settings, U12 exclusion, missing settings, Manager KM view and existing table navigation wiring.');
