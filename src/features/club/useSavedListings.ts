import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabaseClient';
export function useSavedListings(userId?:string){
 const [state,setState]=useState<{owner?:string;ids:string[];loading:boolean;error:string}>({ids:[],loading:false,error:''});
 const locks=useRef(new Set<string>());const [pending,setPending]=useState<string[]>([]);
 useEffect(()=>{
  let active=true,version=0;
  const refresh=async()=>{const request=++version;if(!userId){setState({owner:userId,ids:[],loading:false,error:''});return;}
   try{const {data,error}=await supabase.from('exchange_saved_listings').select('listing_id').eq('user_id',userId);if(error)throw error;if(active&&request===version)setState({owner:userId,ids:(data||[]).map(r=>r.listing_id),loading:false,error:''});}
   catch{if(active&&request===version)setState(s=>({...s,owner:userId,loading:false,error:'Merkliste konnte nicht geladen werden. Bitte erneut öffnen.'}));}
  };
  setState({owner:userId,ids:[],loading:!!userId,error:''});void refresh();
  const listen=()=>void refresh();
  if(typeof window!=='undefined'){window.addEventListener?.('focus',listen);window.addEventListener?.('exchange-saved-changed',listen);}
  return()=>{active=false;if(typeof window!=='undefined'){window.removeEventListener?.('focus',listen);window.removeEventListener?.('exchange-saved-changed',listen);}};
 },[userId]);
 const current=state.owner===userId?state:{owner:userId,ids:[],loading:!!userId,error:''};
 const saved=new Set(current.ids);
 const toggle=async(id:string)=>{
  if(!userId||current.loading||locks.current.has(id))return;
  locks.current.add(id);setPending([...locks.current]);
  const remove=saved.has(id);
  try{const result=remove?await supabase.from('exchange_saved_listings').delete().eq('user_id',userId).eq('listing_id',id):await supabase.from('exchange_saved_listings').upsert({user_id:userId,listing_id:id},{onConflict:'user_id,listing_id',ignoreDuplicates:true});if(result.error)throw result.error;
   setState(s=>s.owner===userId?{...s,ids:remove?s.ids.filter(v=>v!==id):[...new Set([...s.ids,id])],error:''}:s);
   if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('exchange-saved-changed'));
  }catch{setState(s=>s.owner===userId?{...s,error:'Merken konnte nicht gespeichert werden. Bitte erneut versuchen.'}:s);}
  finally{locks.current.delete(id);setPending([...locks.current]);}
 };
 return {saved,ids:current.ids,loading:current.loading,error:current.error,pending,toggle};
}
