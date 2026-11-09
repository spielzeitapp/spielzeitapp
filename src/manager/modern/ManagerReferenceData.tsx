import React,{createContext,useContext,useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useSession} from '../../auth/useSession';
import {useManagerWorkMode} from '../ManagerWorkModeContext';
import {useManagerClubModules} from '../ManagerClubModulesContext';
import {loadSetup,type SetupSnapshot} from '../../lib/managerSetup';
import {supabase} from '../../lib/supabaseClient';

type CentralData={canReviewClub:boolean;seasonId:string|null;clubId:string|null;snapshot:SetupSnapshot|null;photo:boolean|null;loading:boolean;error:string|null};
const Context=createContext<CentralData>({canReviewClub:false,seasonId:null,clubId:null,snapshot:null,photo:null,loading:false,error:null});
export const useReferenceData=()=>useContext(Context);
export function ManagerReferenceData({children}:{children:React.ReactNode}){
 const session=useSession(),{pathname,search}=useLocation();
 const {workMode,supportSession}=useManagerWorkMode();
 const modules=useManagerClubModules();
 const global=workMode==='platform_admin'&&!supportSession;
 const routeSeason=/^\/manager\/saisons\/([^/]+)\/(kader|zugaenge|oefb-import)/.exec(pathname)?.[1];
 const routeClub=/^\/manager\/vereine\/([^/]+)/.exec(pathname)?.[1];
 const seasonId=routeSeason??(routeClub?new URLSearchParams(search).get('setupSeason'):null)??(!global?session.viewTeamSeasonId??session.selectedTeamSeasonId:null);
 const clubId=routeClub??supportSession?.clubId??(!global?modules.clubId:null);
 const allowed=session.backendRole==='admin';
 const [result,setResult]=useState<{key:string;snapshot:SetupSnapshot|null;photo:boolean|null;error:string|null}|null>(null);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener('manager-setup-changed',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('manager-setup-changed',refresh);window.removeEventListener('focus',refresh);};},[]);
 useEffect(()=>{let active=true;if(!seasonId||!allowed)return;void Promise.all([loadSetup(seasonId),supabase.from('team_photos').select('photo_url').eq('team_season_id',seasonId).maybeSingle()]).then(([setup,photo])=>{if(active)setResult({key:seasonId,snapshot:setup.data,photo:photo.error?null:Boolean(photo.data?.photo_url),error:setup.error||photo.error?.message||null});}).catch(()=>{if(active)setResult({key:seasonId,snapshot:null,photo:null,error:'Einrichtungsstatus konnte nicht geladen werden.'});});return()=>{active=false;};},[seasonId,allowed,revision]);
 const current=allowed&&result?.key===seasonId?result:null;
 return <Context.Provider value={{canReviewClub:allowed,seasonId,clubId,snapshot:current?.snapshot??null,photo:current?.photo??null,error:current?.error??null,loading:Boolean(seasonId&&allowed&&!current)}}>{children}</Context.Provider>;
}

export {referenceSteps} from './ManagerReferenceSteps';
