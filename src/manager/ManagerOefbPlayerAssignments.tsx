import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { assignmentPreview, type AssignmentReport, type PublicReport, type SourcePlayer } from '../lib/oefbPlayerAssignments';

type Player = { id: string; first_name: string; last_name: string };
type Context = { players: Player[]; links: { external_player_id: string; player_id: string }[]; games: { external_id: string; is_home: boolean }[] };
type Choice = { target: string; first: string; last: string };
type Preview = { seasonId: string; players: SourcePlayer[]; roster: Player[]; reports: AssignmentReport[]; choices: Record<string, Choice>; unavailable: number };

export function ManagerOefbPlayerAssignments({ seasonId, onSaved }: { seasonId: string; onSaved: () => void }) {
 const [preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
 const [notice,setNotice]=useState<string|null>(null); const [confirmed,setConfirmed]=useState(false);
 const [progress,setProgress]=useState('');
 useEffect(()=>{setPreview(null);setError(null);setNotice(null);setConfirmed(false);},[seasonId]);
 const active=preview?.seasonId===seasonId?preview:null;
 async function load(){
  setBusy(true);setError(null);setNotice(null);setConfirmed(false);setPreview(null);
  try {
   const {data,error:dbError}=await supabase.rpc('oefb_assignment_context',{p_team_season_id:seasonId});
   if(dbError)throw Error(dbError.message);
   const context=data as Context;
   const sources=new Map<string,SourcePlayer>(); const reports:AssignmentReport[]=[];let unavailable=0;
   for(let i=0;i<context.games.length;i++){
    const game=context.games[i];setProgress(`ÖFB-Bericht ${i+1} von ${context.games.length}`);
    try {
     const response=await fetch(`/api/oefb/table?view=report&id=${game.external_id}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
     if(!response.ok)throw Error('unavailable');
     const report=await response.json() as PublicReport;
     if(report.id!==game.external_id)throw Error('wrong report');
     const next=assignmentPreview(report,game.is_home);
     next.players.forEach(p=>sources.set(p.externalPlayerId,p));
     if(next.report)reports.push(next.report);else unavailable++;
    }catch{unavailable++;}
   }
   const players=[...sources.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
   const choices:Record<string,Choice>={};
   players.forEach(p=>{const parts=p.name.trim().split(/\s+/);choices[p.externalPlayerId]={target:context.links.find(l=>l.external_player_id===p.externalPlayerId)?.player_id??'',first:parts.shift()??'',last:parts.join(' ')};});
   setPreview({seasonId,players,roster:context.players,reports,choices,unavailable});
   if(!context.games.length)setNotice('Noch keine abgeschlossenen ÖFB-Spiele importiert. Spiele und Ergebnisse zuerst laden; danach hier die Zuordnung ergänzen.');
  }catch(e){setError(e instanceof Error?e.message:'Vorschau konnte nicht geladen werden.');}finally{setBusy(false);setProgress('');}
 }
 function choose(id:string,patch:Partial<Choice>){setConfirmed(false);setPreview(p=>p?{...p,choices:{...p.choices,[id]:{...p.choices[id],...patch}}}:p);}
 const selected=active?.players.filter(p=>active.choices[p.externalPlayerId]?.target)??[];
 async function save(){
  if(!active||!confirmed)return;setBusy(true);setError(null);setNotice(null);
  try {
   const p_players=selected.map(p=>{const choice=active.choices[p.externalPlayerId];return {external_player_id:p.externalPlayerId,source_name:p.name,player_id:choice.target==='new'?null:choice.target,first_name:choice.first,last_name:choice.last};});
   const {data,error:saveError}=await supabase.rpc('save_oefb_player_assignments',{p_team_season_id:seasonId,p_players,p_reports:active.reports});
   if(saveError)throw Error(saveError.message);
   const result=data as {created:number;mapped:number;assigned_goals:number;unresolved_goals:number;protected_matches:number};
   setNotice(`${result.created} Spieler angelegt · ${result.mapped} Zuordnungen bestätigt · ${result.assigned_goals} Tore zugeordnet · ${result.unresolved_goals} Tore noch ohne Zuordnung · ${result.protected_matches} Spiele unverändert geschützt.`);
   setConfirmed(false);setPreview(null);onSaved();
  }catch(e){setError(e instanceof Error?e.message:'Speichern fehlgeschlagen.');}finally{setBusy(false);}
 }
 return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
  <div><h2 className="text-lg font-bold text-slate-900">ÖFB-Spieler zuordnen & Tore nachtragen</h2>
   <p className="mt-1 text-sm text-slate-600">Auch nach dem Spielimport möglich. Spieler aus den Aufstellungen eurer abgeschlossenen Spiele prüfen und mit dem Saisonkader verbinden.</p>
   <p className="mt-2 text-xs text-slate-500">Keine automatische Namenszuordnung. Keine vollständige Kaderliste: Spieler ohne Einsatz können fehlen. Spielzeiten, Wechsel, Endstände und Trainerangaben bleiben erhalten.</p></div>
  <button type="button" disabled={busy} onClick={()=>void load()} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?progress||'Wird gespeichert…':'ÖFB-Spieler & Berichte prüfen'}</button>
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
  {notice?<p role="status" className="text-sm text-emerald-700">{notice}</p>:null}
  {active?.unavailable?<p className="text-sm text-amber-800">{active.unavailable} Berichte nicht verfügbar oder Torverlauf unvollständig. Diese Tore werden nicht übernommen.</p>:null}
  {active?.players.length?<>
   <p className="text-sm text-slate-600">{active.players.length} ÖFB-Spieler · {active.reports.length} vollständige Spielberichte. Nicht ausgewählte Spieler bleiben offen.</p>
   <div className="space-y-3">{active.players.map(p=>{const c=active.choices[p.externalPlayerId];return <div key={p.externalPlayerId} className="rounded-xl border border-slate-200 p-3">
    <p className="font-semibold text-slate-900">{p.name}</p><p className="text-xs text-slate-500">ÖFB-ID {p.externalPlayerId}</p>
    <label className="mt-2 block text-sm text-slate-700">Zuordnung<select disabled={busy} value={c.target} onChange={e=>choose(p.externalPlayerId,{target:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900">
     <option value="">Noch nicht zuordnen</option>{active.roster.map(r=><option key={r.id} value={r.id}>{r.first_name} {r.last_name} · vorhandenes Profil</option>)}<option value="new">Als neuen Spieler anlegen</option>
    </select></label>
    {c.target==='new'?<div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-sm">Vorname<input disabled={busy} value={c.first} onChange={e=>choose(p.externalPlayerId,{first:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="text-sm">Nachname<input disabled={busy} value={c.last} onChange={e=>choose(p.externalPlayerId,{last:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label></div>:null}
   </div>;})}</div>
   <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />Ich habe die Identitäten und Namen geprüft. Ausgewählte neue Spieler dürfen angelegt und zugeordnete Tore nachgetragen werden.</label>
   <button type="button" disabled={busy||!confirmed||!selected.length} onClick={()=>void save()} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Zuordnung speichern & Tore nachtragen</button>
  </>:null}
 </section>;
}
