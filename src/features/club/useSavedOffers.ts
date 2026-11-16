import {useEffect,useState} from 'react';import {supabase} from '../../lib/supabaseClient';
export type SavedOffer={id:string;title:string;category:string;size:string;condition:string;offer:string;price:number|null;description:string;status:string;created_at:string;photos:string[];internal?:boolean};
/** Merge public approvals and caller-readable internal rows; no owner/contact fields. */
export function useSavedOffers(userId:string|undefined,clubId:string,ids:string[],active:boolean){
 const key=JSON.stringify([userId,clubId,ids,active]);
 const [state,setState]=useState<{key:string;items:SavedOffer[];loading:boolean;error:string}>({key:'',items:[],loading:false,error:''});
 useEffect(()=>{let alive=true;if(!active||!userId){setState({key,items:[],loading:false,error:''});return;}setState({key,items:[],loading:true,error:''});void(async()=>{
 const all=new Map<string,SavedOffer>();
 for(let offset=0;offset<ids.length;offset+=50){if(!alive)return;const batch=ids.slice(offset,offset+50);const [response,privateRows]=await Promise.all([fetch(`/api/exchange/public?club=${encodeURIComponent(clubId)}&ids=${batch.join(',')}`,{cache:'no-store'}),supabase.from('exchange_listings').select('id,title,category,size,condition,offer,price,description,status,created_at,photo_paths').eq('club_id',clubId).in('id',batch).in('status',['Verfügbar','Reserviert'])]);
 if(!response.ok||privateRows.error)throw Error();const data=await response.json();for(const item of data.items)all.set(item.id,item);
 for(const item of privateRows.data||[]){if(all.has(item.id))continue;const signed=await supabase.storage.from('exchange-photos').createSignedUrls(item.photo_paths,900);if(signed.error)throw Error();const {photo_paths,...fields}=item;all.set(item.id,{...fields,internal:true,photos:(signed.data||[]).map(p=>p.signedUrl).filter(Boolean)});}
 }if(alive)setState({key,items:ids.flatMap(id=>all.has(id)?[all.get(id)!]:[]),loading:false,error:''});
 })().catch(()=>{if(alive)setState({key,items:[],loading:false,error:'Gemerkte Angebote konnten nicht geladen werden. Bitte erneut öffnen.'});});return()=>{alive=false;};},[key]);
 return state.key===key?state:{key,items:[],loading:active&&!!userId,error:''};
}
