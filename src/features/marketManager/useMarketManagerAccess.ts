import {useEffect,useState} from 'react';
import {marketDisplayName} from '../club/marketIdentity';
import {supabase} from '../../lib/supabaseClient';
export type MarketManagerClub={id:string;name:string;sourceName?:string;market:boolean;teams:boolean;admin:boolean;cash?:boolean};
export function useMarketManagerAccess(userId?:string){
 const [state,setState]=useState<{owner?:string;clubs:MarketManagerClub[];loading:boolean;error:string}>({clubs:[],loading:false,error:''});
 useEffect(()=>{let active=true,version=0;async function refresh(){const request=++version;if(!userId){setState({owner:userId,clubs:[],loading:false,error:''});return;}setState(s=>({owner:userId,clubs:s.owner===userId?s.clubs:[],loading:true,error:''}));try{const r=await supabase.rpc('exchange_manager_clubs');if(r.error)throw r.error;if(active&&request===version)setState({owner:userId,clubs:(r.data||[]).map((c:MarketManagerClub)=>({...c,sourceName:c.name,name:marketDisplayName(c.id,c.name)})),loading:false,error:''});}catch{if(active&&request===version)setState({owner:userId,clubs:[],loading:false,error:'Verwaltungsrechte konnten nicht geladen werden.'});}}void refresh();window.addEventListener('focus',refresh);window.addEventListener('exchange-manager-rights-changed',refresh);return()=>{active=false;window.removeEventListener('focus',refresh);window.removeEventListener('exchange-manager-rights-changed',refresh);};},[userId]);
 return state.owner===userId?state:{owner:userId,clubs:[],loading:!!userId,error:''};
}
