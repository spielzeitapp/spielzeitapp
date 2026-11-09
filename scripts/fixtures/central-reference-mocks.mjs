// Development-only data adapters for visual inspection of production components.
export function referenceMocks(){return {name:'reference-fixtures',setup(api){
 const modules={
 session:`const rows=['KM','U13','U12'].map((age,i)=>({id:'season-'+i,team:{id:'team-'+i,name:'USC Rohrbach',club_id:'club',age_group:age,clubs:{name:'USC Kaschütz Rohrbach'}},age_group:age,status:'active',season:{id:'year',name:'2026/27'}}));export const useSession=()=>({backendRole:'trainer',teamSeasons:rows,selectedTeamSeason:rows[0],selectedTeamSeasonId:'season-0',viewTeamSeason:null,viewTeamSeasonId:null,setSelectedTeamSeasonId:()=>{},setViewTeamSeasonId:()=>{},signOut:async()=>{},membershipRole:'trainer',loading:false});export const fixtureRows=rows;`,
 work:`import {fixtureRows} from './session';export const useManagerWorkMode=()=>({workMode:'trainer',supportSession:null,contextTeamSeasons:fixtureRows,availableModes:['trainer'],isTrainerMode:true,selectTrainerTeamSeasonId:()=>{}});`,
 modules:`export const useManagerClubModules=()=>({clubId:'club',isModuleEnabled:()=>true});`,
 communication:`export const useCommunicationAccess=()=>({access:{speaker:true,music:true}});`,
 env:`export const isStagingApp=()=>true;`,
 auth:`export const useAuth=()=>({user:null});`,
 profile:`export const useProfile=()=>({profile:{}});export const getDisplayFirstName=()=> 'Johannes';export const profileDisplayName=()=> 'Johannes Baumann';`,
 appearance:`import React from 'react';export const useManagerAppearance=()=>({branding:null,clubName:'USC Kaschütz Rohrbach'});export const ManagerAppearanceToggle=()=>React.createElement('button',{className:'manager-appearance-toggle',onClick:()=>{const root=document.querySelector('.szc-app');root.dataset.managerAppearance=root.dataset.managerAppearance==='day'?'night':'day';}},'☼');`,
 data:`export const ManagerReferenceData=({children})=>children;export const useReferenceData=()=>({seasonId:'season-0',clubId:'club',snapshot:null,photo:null,loading:false,canReviewClub:false,error:null});export {referenceSteps} from '../../src/manager/modern/ManagerReferenceSteps';`,
 favorites:`export const TeamSwitcher=()=>null;`,
 events:`export const useEvents=()=>({events:[],loading:false,error:null});`,
 players:`export const usePlayers=()=>({players:Array.from({length:29},(_,id)=>({id})),loading:false,error:null});`,
 sidebar:`export const MANAGER_TO_APP_HOME_PATH='/app';export const ManagerMenuButton=()=>null;`,
 platform:`export const ManagerComparisonPlatformContextSelect=()=>null;`
 };
 const patterns=[[/auth\/useSession$/,'session'],[/ManagerWorkModeContext$/,'work'],[/ManagerClubModulesContext$/,'modules'],[/CommunicationAccessContext$/,'communication'],[/appEnvironment$/,'env'],[/auth\/AuthProvider$/,'auth'],[/auth\/useProfile$/,'profile'],[/appearance\/ManagerAppearance$/,'appearance'],[/ManagerReferenceData$/,'data'],[/TeamSwitcher$/,'favorites'],[/hooks\/useEvents$/,'events'],[/hooks\/usePlayers$/,'players'],[/components\/ManagerSidebar$/,'sidebar'],[/\.\/ManagerSidebar$/,'sidebar'],[/ManagerComparisonPlatformContextSelect$/,'platform']];
 for(const [filter,path] of patterns)api.onResolve({filter},()=>({path,namespace:'reference-fixture'}));
 api.onResolve({filter:/^\.\/session$/,namespace:'reference-fixture'},()=>({path:'session',namespace:'reference-fixture'}));
 api.onResolve({filter:/ManagerReferenceSteps$/,namespace:'reference-fixture'},()=>({path:process.cwd()+'/src/manager/modern/ManagerReferenceSteps.ts'}));
 api.onLoad({filter:/.*/,namespace:'reference-fixture'},({path})=>({loader:'js',contents:modules[path],resolveDir:process.cwd()}));
}};}
