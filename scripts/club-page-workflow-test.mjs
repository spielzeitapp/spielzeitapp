import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
const seasons=[{id:'u12',team_id:'t12',team_name:'SPG Rohrbach',age_group:'U12',season_name:'2026/27',status:'active'},{id:'u13',team_id:'t13',team_name:'SPG Rohrbach',age_group:'U13',season_name:'2026/27',status:'active'}];
globalThis.__detail={id:'nsg',name:'NSG',status:'active',teams:[{id:'t12',name:'SPG Rohrbach'},{id:'t13',name:'SPG Rohrbach'}],team_seasons:seasons,staff:[],venues:[]};
const mocks=`export const isStagingApp=()=>true;export const useSession=()=>({backendRole:'admin',loading:false,reloadSessionTeamSeasons:async()=>{}});export const isPlatformAdminRole=()=>true;export const getPlatformClub=async()=>({data:globalThis.__detail,error:null});export const listClubModules=async()=>({data:[],error:null});export const getClubBranding=async()=>({data:{},error:null});export const adminListGrantableVenues=async()=>({data:[],error:null});export const adminListTeamStaffInvites=async()=>({data:[],error:null});export const DEFAULT_CLUB_BRANDING={};export const formatTeamSeasonContextLabel=s=>s.teamName+' · '+s.ageGroup+' · '+s.seasonName;export const formatClubTeamOptionLabel=s=>s;export const useManagerWorkMode=()=>({startSupportSession:options=>{globalThis.__support=options}});export const adminAssignClubAdmin=()=>{};export const adminAssignTeamSeasonStaff=()=>{};export const adminEnsureTeamSeason=()=>{};export const adminInviteTeamStaffByEmail=()=>{};export const adminLookupUserByEmail=()=>{};export const archivePlatformClub=()=>{};export const deleteEmptyPlatformClub=()=>{};export const restorePlatformClub=()=>{};export const updatePlatformClub=()=>{};export const adminSetClubModule=()=>{};export const saveClubBranding=()=>{};export const createSetupTeam=async()=>{globalThis.__detail={...globalThis.__detail,team_seasons:[...globalThis.__detail.team_seasons,{id:'u14',team_id:'t14',team_name:'New team',age_group:'U14',season_name:'2026/27',status:'active'}]};return {data:{team_id:'t14',team_season_id:'u14',status:'created'},error:null}};`;
const built=await build({entryPoints:['src/manager/ManagerClubDetailPage.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'mocks',setup(b){
 b.onResolve({filter:/^react$/},()=>({path:'react',external:true}));
 b.onResolve({filter:/\/(?:lib|auth)\/|ManagerWorkModeContext$/},()=>({path:'data',namespace:'data'}));b.onLoad({filter:/.*/,namespace:'data'},()=>({contents:mocks,loader:'js'}));
 b.onResolve({filter:/^\.\//},args=>args.kind==='entry-point'?undefined:({path:args.path.split('/').at(-1),namespace:'child'}));
 b.onLoad({filter:/.*/,namespace:'child'},args=>({contents:`import React from 'react';export function ${args.path}(props){return React.createElement('section',{'data-component':'${args.path}',context:props},props.preview||null);}`,loader:'js'}));
}}]});
const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);
const {MemoryRouter,Routes,Route,useLocation,useNavigate}=require('react-router-dom');
let nav;function Probe(){nav=useNavigate();const l=useLocation();return React.createElement('output',null,l.pathname+l.search+l.hash);}
globalThis.window={location:{search:'?setupSeason=u13'}};
const target={scrollIntoView(){globalThis.__scrolls++},parentElement:null};
globalThis.document={getElementById(){return target}};globalThis.HTMLDetailsElement=class {};globalThis.__scrolls=0;
let tree;
const component=name=>tree.root.findByProps({'data-component':name});
try{
 await act(async()=>{tree=create(React.createElement(MemoryRouter,{initialEntries:['/manager/vereine/nsg?setupSeason=u13&setupStep=photo']},React.createElement(Probe),React.createElement(Routes,null,React.createElement(Route,{path:'/manager/vereine/:clubId',element:React.createElement(mod.exports.ManagerClubDetailPage)}))))});
 assert.equal(component('ManagerAppPreviewPanel').props.context.teamSeasonId,'u13','Preview opens for requested team');
 assert.equal(component('ManagerSetupChecklist').props.context.seasonId,'u13');
 assert.equal(component('ManagerSetupChecklist').props.context.initialStep,'photo');
 assert.equal(component('ManagerSetupChecklist').props.context.hideSelector,true,'No second team picker inside setup');
 assert.equal(component('ManagerTrainerPhotoPanel').props.context.seasonId,'u13','Trainer photo context follows requested team, not first club team');
 assert.equal(component('ManagerClubVenueGrantsPanel').props.context.selectedTeamSeasonId,'u13');
 assert.equal(component('ManagerClubImportPanel').props.context.showOverview,false,'Only one team overview');
 await act(async()=>component('ManagerClubTeamOverview').props.context.onSelect('u12'));
 assert.equal(component('ManagerAppPreviewPanel').props.context.teamSeasonId,'u12');
 assert.equal(component('ManagerTrainerPhotoPanel').props.context.seasonId,'u12');
 assert.equal(component('ManagerClubVenueGrantsPanel').props.context.selectedTeamSeasonId,'u12');
 assert.ok(tree.root.findByType('output').children.join('').includes('setupSeason=u12'));
 assert.ok(!tree.root.findByType('output').children.join('').includes('setupStep='),'Old team task does not carry over');
 // Header-style route changes must update all workspace context too.
 await act(async()=>nav('/manager/vereine/nsg?setupSeason=u13&setupStep=staff#manager-setup-checklist'));
 assert.equal(component('ManagerAppPreviewPanel').props.context.teamSeasonId,'u13');
 assert.equal(component('ManagerSetupChecklist').props.context.initialStep,'staff');
 await act(async()=>component('ManagerSetupChecklist').props.context.onAction('training','u13'));
 assert.equal(globalThis.__support.initialTeamSeasonId,'u13');assert.equal(globalThis.__support.initialPath,'/manager/termine');
 await act(async()=>component('ManagerAppPreviewPanel').props.context.onClose());
 assert.equal(tree.root.findAllByProps({'data-component':'ManagerAppPreviewPanel'}).length,0);
 assert.ok(tree.root.findAllByType('button').some(b=>b.children.join('')==='App-Vorschau einblenden'));
 // Specific edit actions open their collapsed parent and scroll to the real form.
 const parent=new HTMLDetailsElement();parent.open=false;parent.parentElement=null;target.parentElement=parent;
 await act(async()=>component('ManagerSetupChecklist').props.context.onAction('club','u13'));
 assert.equal(parent.open,true);assert.ok(globalThis.__scrolls>0);
 await act(async()=>nav('/manager/vereine/nsg'));
 assert.ok(tree.root.findByType('output').children.join('').includes('setupSeason=u12'),'Default selection is reflected in global header URL');
 await act(async()=>tree.root.findAllByType('input').find(i=>i.props.placeholder==='z. B. SPG Rohrbach').props.onChange({target:{value:'New team'}}));
 await act(async()=>tree.root.findByProps({id:'club-team-season-setup'}).props.onSubmit({preventDefault(){}}));
 assert.equal(component('ManagerAppPreviewPanel').props.context.teamSeasonId,'u14','Newly created season becomes selected instead of snapping back to previous URL');
 assert.equal(component('ManagerTrainerPhotoPanel').props.context.seasonId,'u14');
 assert.ok(tree.root.findByType('output').children.join('').includes('setupSeason=u14'));
 await act(async()=>component('ClubBrandingFields').props.context.onLogoFile({name:'old-club-draft.png'}));
 globalThis.__detail={...globalThis.__detail,id:'melk',name:'SC Melk',team_seasons:[{...seasons[0],id:'m16',team_id:'mt16',team_name:'SC Melk FR',age_group:'U16'}]};
 await act(async()=>nav('/manager/vereine/melk'));
 assert.equal(component('ManagerAppPreviewPanel').props.context.teamSeasonId,'m16');
 assert.equal(component('ManagerAppPreviewPanel').props.context.clubId,'melk');
 assert.equal(component('ManagerAppPreviewPanel').props.context.logoFile,null,'A logo draft must not leak into another club');
 assert.equal(component('ManagerTrainerPhotoPanel').props.context.seasonId,'m16');
 console.log('PASS club workflow: route/overview/preview/trainer/venue context, direct task, one overview, collapsible edit targets and support navigation.');
}finally{await act(async()=>tree?.unmount());}
