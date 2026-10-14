import React,{createContext,useContext,useEffect,useState} from 'react';
import {useSession} from '../auth/useSession';
import {supabase} from '../lib/supabaseClient';
import {NO_COMMUNICATION_ACCESS,parseCommunicationAccess,type CommunicationAccess} from '../lib/communicationAccessModel';
const Context=createContext<{access:CommunicationAccess;loading:boolean;error:string|null}>({access:NO_COMMUNICATION_ACCESS,loading:true,error:null});
export function CommunicationAccessProvider({children}:{children:React.ReactNode}){
 const {user,viewTeamSeasonId,selectedTeamSeasonId}=useSession();const id=viewTeamSeasonId??selectedTeamSeasonId;
 const [state,setState]=useState({access:NO_COMMUNICATION_ACCESS,loading:true,error:null as string|null,scope:''});
 const scope=(user?.id??'')+':'+(id??'');
 useEffect(()=>{let active=true,version=0;
  async function reload(){const token=++version;if(!id||!user){setState({access:NO_COMMUNICATION_ACCESS,loading:false,error:null,scope});return;}
   const {data,error}=await supabase.rpc('get_my_communication_access',{p_team_season_id:id});
   if(active&&token===version)setState({access:parseCommunicationAccess(data,!!error),loading:false,error:error?'Freigaben konnten nicht geprüft werden.':null,scope});
  }
  void reload();const timer=window.setInterval(()=>void reload(),30000);window.addEventListener('focus',reload);
  return()=>{active=false;version++;window.clearInterval(timer);window.removeEventListener('focus',reload);};
 },[id,user?.id]);
 const value=state.scope===scope?state:{access:NO_COMMUNICATION_ACCESS,loading:true,error:null};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCommunicationAccess(){return useContext(Context);}
