import React, {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../../lib/supabaseClient';

export type ScreenAccess = {canScreen:boolean;canManage:boolean;loading:boolean;error:boolean};
const denied = {canScreen:false,canManage:false,loading:true,error:false};

export function useTournamentScreenAccess(eventId:string) {
 const [state,setState]=useState<{eventId:string;access:ScreenAccess}>({eventId,access:denied});
 const setAccess=(access:ScreenAccess)=>setState({eventId,access});
 const request=useRef(0);
 const refresh=useCallback(async()=>{
  const sequence=++request.current;
  try {
   const {data,error}=await supabase.rpc('tournament_screen_access',{p_event_id:eventId});
   if(sequence!==request.current)return;
   setAccess({canScreen:!error&&data?.canScreen===true,canManage:!error&&data?.canManage===true,loading:false,error:!!error});
  } catch {if(sequence===request.current)setAccess({...denied,loading:false,error:true});}
 },[eventId]);
 useEffect(()=>{
  let active=true;
  let lastUser:string|null|undefined;
  setAccess(denied);void refresh();
  // Recheck assignments and revocations while the display stays open.
  const timer=window.setInterval(()=>void refresh(),20000);
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
   const nextUser=session?.user.id??null;
   if(event==='SIGNED_OUT'||lastUser!==nextUser){request.current++;setAccess(denied)}
   lastUser=nextUser;window.setTimeout(()=>{if(active)void refresh()},0);
  });
  const focus=()=>void refresh();window.addEventListener('focus',focus);
  return()=>{active=false;request.current++;window.clearInterval(timer);subscription.unsubscribe();window.removeEventListener('focus',focus)};
 },[refresh]);
 return {access:state.eventId===eventId?state.access:denied,refresh};
}

type Member={user_id:string;label:string;assigned:boolean};
export function TournamentScreenManagers({eventId,onChanged}:{eventId:string;onChanged:()=>void}) {
 const [open,setOpen]=useState(false),[members,setMembers]=useState<Member[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try {const result=await supabase.rpc('tournament_screen_members',{p_event_id:eventId});
   if(result.error)throw result.error;setMembers(Array.isArray(result.data)?result.data:[]);
  }catch{setError('Turnierleitung konnte nicht geladen werden.')}finally{setLoading(false)};
 };
 const assign=async(member:Member)=>{
  setBusy(member.user_id);setError('');
  try{const {error}=await supabase.rpc('tournament_screen_assign',{p_event_id:eventId,p_user_id:member.user_id,p_assigned:!member.assigned});
   if(error)throw error;await load();onChanged();
  }catch{setError('Zuordnung konnte nicht gespeichert werden. Bitte erneut versuchen.')}finally{setBusy(null)};
 };
 return <div className="mt-3"><button type="button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load()}} className="font-bold">Turnierleitung verwalten {open?'⌃':'⌄'}</button>{open?<div className="mt-3 space-y-3"><p className="text-sm">Admins können den Bildschirmmodus verwenden. Zusätzlich kannst du Trainer für dieses Turnier freigeben.</p>{loading?<p role="status">Trainer werden geladen…</p>:members.length?members.map(member=><label key={member.user_id} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--t-border)] p-3"><span>{member.label}</span><input type="checkbox" aria-label={`${member.label} als Turnierleitung`} checked={member.assigned} disabled={busy!==null} onChange={()=>void assign(member)}/></label>):<p>Noch keine Trainer zugeordnet.</p>}{error?<p role="alert">{error}</p>:null}</div>:null}</div>;
}
