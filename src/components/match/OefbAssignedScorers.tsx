import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export function OefbAssignedScorers({ eventId }: { eventId: string }) {
 const [state,setState]=useState<{eventId:string;names:string[]}|null>(null);
 useEffect(()=>{
  let active=true;
  void(async()=>{
   const {data:event}=await supabase.from('events').select('match_id').eq('id',eventId).maybeSingle();
   if(!event?.match_id)return;
   const [{data:goals},{data:localGoals,error:localError}]=await Promise.all([
    supabase.from('oefb_goal_attributions').select('player_id, score_home, score_away, players(first_name,last_name), matches(score_home,score_away)').eq('match_id',event.match_id),
    supabase.from('match_events').select('id').eq('match_id',event.match_id).in('type',['goal','goal_home','goal_away']),
   ]);
   if(!active||localError||localGoals?.length)return;
   const counts=new Map<string,{name:string;goals:number}>();
   for(const g of goals??[]){
    const m=Array.isArray(g.matches)?g.matches[0]:g.matches;
    const p=Array.isArray(g.players)?g.players[0]:g.players;
    if(!p||m?.score_home!==g.score_home||m?.score_away!==g.score_away)continue;
    const prev=counts.get(g.player_id);counts.set(g.player_id,{name:[p.first_name,p.last_name].filter(Boolean).join(' '),goals:(prev?.goals??0)+1});
   }
   setState({eventId,names:[...counts.values()].map(p=>`${p.name} · ${p.goals} ${p.goals===1?'Tor':'Tore'}`)});
  })();
  return()=>{active=false;};
 },[eventId]);
 if(state?.eventId!==eventId||!state.names.length)return null;
 return <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-950/15 p-3"><h4 className="text-sm font-bold text-emerald-200">Mit euren Spielerprofilen verknüpft</h4>{state.names.map(n=><p key={n} className="mt-1 text-sm text-white/75">{n}</p>)}<p className="mt-2 text-xs text-white/45">Bestätigte ÖFB-Tore · ohne Eigentore · keine Spielzeiten übernommen</p></div>;
}
