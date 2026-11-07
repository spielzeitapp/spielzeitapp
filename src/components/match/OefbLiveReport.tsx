import React, { useEffect, useState } from 'react';
import { listRoster, type RosterPlayer } from '../../lib/rosterService';
import { normalizedAssignmentName } from '../../lib/oefbPlayerAssignments';
import { playerPhotoDisplayUrl, preparedPlayerPortrait } from '../../lib/playerPhotoDisplay';
import { supabase } from '../../lib/supabaseClient';

type SourcePlayer = { name: string; number: string; photo?: string|null; firstName?: string; lastName?: string; profileId?:string };
type SourceEvent = { type: string; minute: number | null; side: string | null; player: string; secondPlayer: string; ownGoal: boolean; score: string | null };
export type OefbLiveReportData = { id: string; home: string; away: string; score: string | null; events: SourceEvent[]; homePlayers: SourcePlayer[]; awayPlayers: SourcePlayer[]; ownSide?: 'home'|'away';teamSeasonId?:string };
/** Display-only photo matching is limited to the event's own season and side. */
export function decorateOefbLineup(report: OefbLiveReportData, ownSide: 'home'|'away', roster: RosterPlayer[], teamSeasonId?:string): OefbLiveReportData {
 const key=ownSide==='home'?'homePlayers':'awayPlayers';
 return {...report,ownSide,teamSeasonId,[key]:report[key].map(p=>{
  const matches=roster.filter(r=>normalizedAssignmentName([r.first_name,r.last_name].filter(Boolean).join(' '))===normalizedAssignmentName(p.name));
  const r=matches.length===1?matches[0]:null;
  return {...p,profileId:r?.id,photo:r?.cutout_url||r?.avatar_url||null,firstName:r?.first_name||undefined,lastName:r?.last_name||undefined};
 })};
}
function LineupPhoto({src}:{src?:string|null}) {
 const url=preparedPlayerPortrait(src)||playerPhotoDisplayUrl(src)||'/avatars/player-placeholder.png';
 return <img src={url} alt="" loading="lazy" decoding="async" className="h-[58px] w-[58px] shrink-0 rounded-lg object-cover object-top" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/avatars/player-placeholder.png';}} />;
}
export function useOefbLiveReport(matchId: string | null, enabled: boolean) {
 const [state,setState]=useState<{matchId:string; report:OefbLiveReportData|null; loading:boolean; error:string|null}|null>(null);
 useEffect(()=>{
  if(!matchId||!enabled)return;
  let active=true;const controller=new AbortController();
  setState({matchId,report:null,loading:true,error:null});
  void(async()=>{
   try{
    const {data,error}=await supabase.from('events').select('external_id, team_season_id, is_home').eq('match_id',matchId).eq('external_source','oefb').maybeSingle();
    if(error)throw error;
    if(!data?.external_id||!/^\d{1,10}$/.test(data.external_id)){if(active)setState({matchId,report:null,loading:false,error:null});return;}
    const r=await fetch(`/api/oefb/table?view=report&id=${data.external_id}`,{cache:'no-store',signal:controller.signal});
    let report=await r.json();
    if(!r.ok||report.id!==data.external_id||!Array.isArray(report.events)||!Array.isArray(report.homePlayers)||!Array.isArray(report.awayPlayers))throw Error('Invalid report');
    if(data.team_season_id && typeof data.is_home==='boolean'){
     // Photo failure must not hide an otherwise available report.
     try{const roster=await listRoster(data.team_season_id,'all');report=decorateOefbLineup(report,data.is_home?'home':'away',roster.error?[]:roster.data,data.team_season_id);}catch{/* keep source report */}
    }
    if(active)setState({matchId,report,loading:false,error:null});
   }catch{if(active)setState({matchId,report:null,loading:false,error:'ÖFB-Spielbericht konnte nicht geladen werden. Bitte erneut öffnen.'});}
  })();
  return()=>{active=false;controller.abort();};
 },[matchId,enabled]);
 return enabled&&state?.matchId===matchId?state:{report:null,loading:false,error:null};
}
export function OefbLiveReport({report,view,filter='all',onBack}:{report:OefbLiveReportData;view:'events'|'lineup';filter?:'all'|'goals'|'subs'|'cards';onBack?:()=>void}){
 const events=report.events.filter(e=>filter==='all'||(filter==='goals'?e.type==='goal':filter==='subs'?e.type==='playerchange':['yellow','red','yellowred','card-blue'].includes(e.type))).slice().sort((a,b)=>(b.minute??-1)-(a.minute??-1));
 return <section data-manager-match-surface className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080a10] text-white">
  <header data-manager-match-surface className="z-10 flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#080a10] px-3 py-3">
   {onBack?<button type="button" onClick={onBack} aria-label="Zurück zum Livespiel" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm font-bold text-white active:bg-white/10"><span aria-hidden>←</span> Livespiel</button>:null}
   <h2 className="min-w-0 flex-1 text-lg font-extrabold">{view==='events'?'Liveticker':'Aufstellung'}</h2>
   <span className="shrink-0 rounded-full border border-[rgb(var(--club-border-rgb)/0.4)] px-2 py-1 text-[11px] font-semibold text-white/60">ÖFB</span>
  </header>
  <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-3 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch]">
  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Quelle: ÖFB · Spielbericht</p>
  <p className="mb-3 text-sm font-semibold">{report.home} – {report.away}{report.score?` · ${report.score}`:''}</p>
  {view==='events'?<>{events.length?<ul className="space-y-2">{events.map((e,i)=><li key={i} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
   <span className="w-10 shrink-0 font-bold text-[rgb(var(--club-accent-rgb))]">{e.minute==null?'—':`${e.minute}′`}</span>
   <div className="min-w-0"><p className="font-bold">{e.type==='goal'?`${e.ownGoal?'Eigentor':'⚽ Tor'}${e.score?` · ${e.score}`:''}`:e.type==='playerchange'?'⇄ Wechsel':e.type==='red'?'Rote Karte':e.type==='yellowred'?'Gelb-Rote Karte':e.type==='card-blue'?'Blaue Karte':'Gelbe Karte'}</p><p className="break-words text-sm">{e.player}{e.secondPlayer?` / ${e.secondPlayer}`:''}</p><p className="mt-1 text-xs text-white/50">{e.side==='home'?report.home:e.side==='away'?report.away:''}</p></div>
  </li>)}</ul>:<p className="py-8 text-center text-sm text-white/60">Keine Einträge für diesen Filter laut ÖFB.</p>}</>:<>
   <p className="mb-3 text-xs text-white/55">Aufstellung laut ÖFB. Feldpositionen und Spielzeiten werden nur angezeigt, wenn sie belegt sind.</p>
   {[{name:report.home,players:report.homePlayers,own:report.ownSide==='home'},{name:report.away,players:report.awayPlayers,own:report.ownSide==='away'}].sort((a,b)=>Number(b.own)-Number(a.own)).map((side,index)=><div key={index} className="mb-4"><h3 className="mb-2 font-bold">{side.name}</h3>{side.players.length?<ul className="space-y-1.5">{side.players.map((p,i)=><li key={i} className={side.own?'relative sz-club-list-card sz-club-surface sz-club-surface--quiet flex min-h-[68px] items-center gap-2.5 overflow-hidden rounded-[14px] border px-2.5 py-1':'flex items-center gap-3 rounded-xl border border-white/10 p-3'}>
    {side.own&&p.profileId&&report.teamSeasonId?<a href={'/app/team?teamSeason='+encodeURIComponent(report.teamSeasonId)+'&player='+encodeURIComponent(p.profileId)} aria-label={'Profil von '+p.name+' öffnen'} className="absolute inset-0 z-10 rounded-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--club-accent-rgb))]"/>:null}
    {side.own?<LineupPhoto src={p.photo}/>:null}
    <span className={side.own?'sz-club-number-divider w-12 shrink-0 border-l pl-2.5 text-[25px] font-black text-white':'w-9 shrink-0 text-center text-lg font-extrabold'}>{/^0[0-9]+$/.test(p.number)?Number(p.number):p.number||'—'}</span>
    {side.own?<span className="min-w-0 flex-1 pl-1"><span className="block text-[13px] font-semibold leading-tight text-white/55">{p.firstName||p.name.split(' ')[0]}</span><span className="block break-words text-[17px] font-black leading-tight text-white">{p.lastName||p.name.split(' ').slice(1).join(' ')}</span></span>:<span className="text-sm font-semibold">{p.name}</span>}
   </li>)}</ul>:<p className="text-sm text-white/55">Keine Aufstellung veröffentlicht.</p>}</div>)}
  </>}
  </div>
 </section>;
}
