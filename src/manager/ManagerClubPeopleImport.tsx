import React, {useCallback, useRef, useState} from 'react';
import {useTeamStaff} from '../hooks/useTeamStaff';
import {ManagerOefbRosterPreview} from './ManagerOefbRosterPreview';
import {ManagerOefbStaffPreview} from './ManagerOefbStaffPreview';
import type {OefbImportHandle,OefbImportState} from './oefbImportWorkflow';

const empty:OefbImportState={busy:false,found:0,selected:0,canSave:false,error:''};
/** One review/save for the people belonging to an already confirmed team source. */
export function ManagerClubPeopleImport({seasonId,rosterUrl,onSaved}:{seasonId:string;rosterUrl:string;onSaved:()=>void}) {
 const {staff,loading,error,refetch}=useTeamStaff(seasonId);
 const roster=useRef<OefbImportHandle>(null),trainers=useRef<OefbImportHandle>(null);
 const [r,setR]=useState(empty),[s,setS]=useState(empty);
 const [busy,setBusy]=useState(false),[started,setStarted]=useState(false),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState('');
 const rosterState=useCallback((state:OefbImportState)=>{setR(state);setConfirmed(false);},[]);
 const trainerState=useCallback((state:OefbImportState)=>{setS(state);setConfirmed(false);},[]);
 const active=busy||r.busy||s.busy;
 const blocked=(r.selected>0&&!r.canSave)||(s.selected>0&&!s.canSave);
 const count=r.selected+s.selected;
 const staffUrl=rosterUrl.replace(/Kader\/?$/i,'Trainer-Betreuer/');
 async function read(){
  if(active||loading||error)return;
  setBusy(true);setStarted(true);setConfirmed(false);setNotice('');
  try{await Promise.all([roster.current!.preview(),trainers.current!.preview()]);}
  finally{setBusy(false);}
 }
 async function save(){
  if(active||!confirmed||!count||blocked)return;
  setBusy(true);setNotice('');
  try{
   const outcomes:boolean[]=[];
   if(r.canSave)outcomes.push(await roster.current!.save());
   if(s.canSave)outcomes.push(await trainers.current!.save());
   setNotice(outcomes.every(Boolean)?'Auswahl gespeichert. Nicht zugeordnete Trainer bleiben offen.':'Ein Teil konnte nicht gespeichert werden. Die Hinweise bei Kader und Trainern zeigen, was noch offen ist. Bereits gespeicherte Daten bleiben erhalten.');
   if(outcomes.some(Boolean)){onSaved();window.dispatchEvent(new Event('manager-setup-changed'));}
  }finally{setConfirmed(false);setBusy(false);}
 }
 return <section aria-label="Gemeinsamer Kader- und Trainerimport" className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
  <h4 className="font-bold">Kader & Trainer automatisch übernehmen</h4>
  <p className="text-sm text-slate-600">Einlesen → Vorschläge prüfen → gemeinsam speichern. Gespeicherte ÖFB-IDs und passende Vereinsprofile werden vorgeschlagen. Unklare Personen bitte selbst zuordnen. Fehlende Spieler können neu angelegt werden; Trainer benötigen ein App-Konto.</p>
  {loading&&<p role="status" className="text-sm">Vorhandene Trainer werden geladen…</p>}
  {error&&<p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={()=>void refetch()}>Erneut laden</button></p>}
  <button type="button" disabled={active||loading||Boolean(error)} onClick={()=>void read()} className="min-h-11 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50">{active?'Bitte warten…':started?'Kader & Trainer erneut einlesen':'Kader & Trainer einlesen'}</button>
  <fieldset disabled={active} className="space-y-3">
   <div hidden={!started} className="space-y-3">
    <p role="status" className="text-sm font-semibold">{r.found} Spieler · {s.found} Trainer gefunden · {count} zur Übernahme ausgewählt</p>
    <ManagerOefbRosterPreview seasonId={seasonId} sourceUrl={rosterUrl} workflowRef={roster} onWorkflowState={rosterState}/>
    <ManagerOefbStaffPreview seasonId={seasonId} sourceUrl={staffUrl} staff={staff} onSaved={()=>refetch()} workflowRef={trainers} onWorkflowState={trainerState}/>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Ich habe Mannschaft, Personen, Zuordnungen und Trainerrollen geprüft. Ausgewählte neue Spieler dürfen angelegt werden.</label>
    <button type="button" disabled={active||!confirmed||!count||blocked} onClick={()=>void save()} className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50">Ausgewählten Kader & Trainer übernehmen ({count})</button>
   </div>
  </fieldset>
  {notice&&<p role="status" className="text-sm text-slate-700">{notice}</p>}
 </section>;
}
