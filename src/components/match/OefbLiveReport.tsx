import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type SourceEvent = { type: string; minute: number | null; side: string | null; player: string; secondPlayer: string; ownGoal: boolean; score: string | null };
export type OefbLiveReportData = { id: string; home: string; away: string; score: string | null; events: SourceEvent[]; homePlayers: { name: string; number: string }[]; awayPlayers: { name: string; number: string }[] };
export function useOefbLiveReport(matchId: string | null, enabled: boolean) {
 const [state,setState]=useState<{matchId:string; report:OefbLiveReportData|null; loading:boolean; error:string|null}|null>(null);
 useEffect(()=>{
  if(!matchId||!enabled)return;
  let active=true;const controller=new AbortController();
  setState({matchId,report:null,loading:true,error:null});
  void(async()=>{
   try{
    const {data,error}=await supabase.from('events').select('external_id').eq('match_id',matchId).eq('external_source','oefb').maybeSingle();
    if(error)throw error;
    if(!data?.external_id||!/^\d{1,10}$/.test(data.external_id)){if(active)setState({matchId,report:null,loading:false,error:null});return;}
    const r=await fetch(`/api/oefb/table?view=report&id=${data.external_id}`,{cache:'no-store',signal:controller.signal});
    const report=await r.json();
    if(!r.ok||report.id!==data.external_id||!Array.isArray(report.events)||!Array.isArray(report.homePlayers)||!Array.isArray(report.awayPlayers))throw Error('Invalid report');
    if(active)setState({matchId,report,loading:false,error:null});
   }catch{if(active)setState({matchId,report:null,loading:false,error:'ÖFB-Spielbericht konnte nicht geladen werden. Bitte erneut öffnen.'});}
  })();
  return()=>{active=false;controller.abort();};
 },[matchId,enabled]);
 return enabled&&state?.matchId===matchId?state:{report:null,loading:false,error:null};
}
export function OefbLiveReport({report,view,filter='all'}:{report:OefbLiveReportData;view:'events'|'lineup';filter?:'all'|'goals'|'subs'|'cards'}){
 const events=report.events.filter(e=>filter==='all'||(filter==='goals'?e.type==='goal':filter==='subs'?e.type==='playerchange':['yellow','red','yellowred','card-blue'].includes(e.type))).slice().sort((a,b)=>(b.minute??-1)-(a.minute??-1));
 return <section className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain rounded-2xl border border-[rgb(var(--club-border-rgb)/0.4)] bg-black/50 p-3 text-white [-webkit-overflow-scrolling:touch]">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-bold">{view==='events'?'Spielverlauf':'Aufstellungen'}</h2><span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/65">Quelle: ÖFB</span></div>
  <p className="mb-3 text-sm font-semibold">{report.home} – {report.away}{report.score?` · ${report.score}`:''}</p>
  {view==='events'?<>{events.length?<ul className="space-y-2">{events.map((e,i)=><li key={i} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
   <span className="w-10 shrink-0 font-bold text-[rgb(var(--club-accent-rgb))]">{e.minute==null?'—':`${e.minute}′`}</span>
   <div className="min-w-0"><p className="font-bold">{e.type==='goal'?`${e.ownGoal?'Eigentor':'⚽ Tor'}${e.score?` · ${e.score}`:''}`:e.type==='playerchange'?'⇄ Wechsel':e.type==='red'?'Rote Karte':e.type==='yellowred'?'Gelb-Rote Karte':e.type==='card-blue'?'Blaue Karte':'Gelbe Karte'}</p><p className="break-words text-sm">{e.player}{e.secondPlayer?` / ${e.secondPlayer}`:''}</p><p className="mt-1 text-xs text-white/50">{e.side==='home'?report.home:e.side==='away'?report.away:''}</p></div>
  </li>)}</ul>:<p className="py-8 text-center text-sm text-white/60">Keine Einträge für diesen Filter laut ÖFB.</p>}</>:<>
   <p className="mb-3 text-xs text-white/55">Aufstellung laut ÖFB. Feldpositionen und Spielzeiten werden nur angezeigt, wenn sie belegt sind.</p>
   {[{name:report.home,players:report.homePlayers},{name:report.away,players:report.awayPlayers}].map((side,index)=><div key={index} className="mb-4"><h3 className="mb-2 font-bold">{side.name}</h3>{side.players.length?<ul className="space-y-1.5">{side.players.map((p,i)=><li key={i} className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><span className="w-9 shrink-0 text-center text-lg font-extrabold">{p.number||'—'}</span><span className="text-sm font-semibold">{p.name}</span></li>)}</ul>:<p className="text-sm text-white/55">Keine Aufstellung veröffentlicht.</p>}</div>)}
  </>}
 </section>;
}
