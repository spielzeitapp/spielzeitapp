import React, {useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {managerLookupStaffUserByEmail} from '../lib/platformClubAdmin';
import {type TeamStaffMember, staffDisplayName} from '../hooks/useTeamStaff';
import {OefbPlayerPhoto} from '../components/OefbPlayerPhoto';
import {removePortraitBackground} from '../lib/removePortraitBackground';
import {uploadStaffProfileCutout} from '../lib/profileCutoutUpload';

type Role='trainer'|'head_coach'|'co_trainer';
type Candidate={name:string;sourceRole:string;role:Role;photoUrl:string|null;email:string};
type Target={user_id:string;first_name:string|null;last_name:string|null;avatar_url:string|null;cutout_url?:string|null;role?:string};
type Choice={target:Target|null;email:string;lookup:Target|null;role:Role;takeName:boolean;takePhoto:boolean;cutout:Blob|null;saved?:boolean};
function normalize(s:string){return s.trim().replace(/\s+/g,' ').toLocaleLowerCase('de');}
function CutoutPreview({blob}:{blob:Blob}){
 const [url,setUrl]=useState('');
 useEffect(()=>{const u=URL.createObjectURL(blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[blob]);
 return <img src={url} alt="Freisteller-Vorschau" className="h-48 w-48 rounded-xl bg-slate-800 object-contain"/>;
}
export function ManagerOefbStaffPreview({seasonId,staff,onSaved}:{seasonId:string;staff:TeamStaffMember[];onSaved:()=>void|Promise<unknown>}){
 const generation=useRef(0);
 const [url,setUrl]=useState(''),[source,setSource]=useState('');
 const [people,setPeople]=useState<Candidate[]>([]),[choices,setChoices]=useState<Choice[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 useEffect(()=>()=>{generation.current++;},[seasonId]);
 function patch(i:number,value:Partial<Choice>){setConfirmed(false);setChoices(old=>old.map((c,n)=>n===i?{...c,...value}:c));}
 function choose(i:number,target:Target){const role=['trainer','head_coach','co_trainer'].includes(target.role||'')?target.role as Role:people[i].role;patch(i,{target,role,takeName:!target.first_name&&!target.last_name,takePhoto:!target.avatar_url&&!target.cutout_url,cutout:null});}
 async function preview(){
  if(busy||!url.trim())return;const version=++generation.current;setBusy(true);setError('');setNotice('');setPeople([]);setChoices([]);setConfirmed(false);
  try{
   const response=await fetch('/api/oefb/table?view=staff&url='+encodeURIComponent(url.trim()),{signal:AbortSignal.timeout(20000)});
   const data=await response.json() as {trainers?:Candidate[];sourceUrl?:string;error?:string;notice?:string};
   if(!response.ok||data.error)throw Error(data.error||'Trainer konnten nicht geladen werden.');
   if(version!==generation.current)return;
   const found=data.trainers||[];setSource(data.sourceUrl||url.trim());
   const suggestions=await Promise.all(found.map(async p=>{
    if(!p.email||staff.some(s=>normalize(staffDisplayName(s))===normalize(p.name)))return null;
    const result=await managerLookupStaffUserByEmail({teamSeasonId:seasonId,email:p.email});
    const account=result.data;if(result.error||!account?.user_id)return null;
    return {user_id:account.user_id,first_name:account.first_name||null,last_name:account.last_name||null,avatar_url:null} as Target;
   }));
   if(version!==generation.current)return;
   setChoices(found.map((p,i)=>({target:null,email:p.email||'',lookup:suggestions[i],role:p.role,takeName:false,takePhoto:false,cutout:null})));
   setPeople(found);
   setNotice(data.notice||'');
  }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'ÖFB-Trainer konnten nicht geladen werden.');}
  finally{if(version===generation.current)setBusy(false);}
 }
 async function lookup(i:number){
  if(busy)return;const version=generation.current;setBusy(true);setError('');
  try{const result=await managerLookupStaffUserByEmail({teamSeasonId:seasonId,email:choices[i].email.trim()});
   if(version!==generation.current)return;
   if(result.error||!result.data?.user_id)throw Error(result.error||'Kein App-Konto gefunden. Trainer zuerst registrieren oder im Vereinssetup einladen.');
   const p=result.data;patch(i,{lookup:{user_id:p.user_id!,first_name:p.first_name||null,last_name:p.last_name||null,avatar_url:null}});
  }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Kontosuche fehlgeschlagen.');}
  finally{if(version===generation.current)setBusy(false);}
 }
 async function remove(i:number){
  if(busy||!people[i].photoUrl)return;const version=generation.current;setBusy(true);setError('');
  try{const cutout=await removePortraitBackground(people[i].photoUrl!);if(version===generation.current)patch(i,{cutout,takePhoto:true});}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Freistellung fehlgeschlagen.');}
  finally{if(version===generation.current)setBusy(false);}
 }
 const selected=choices.map((c,i)=>({c,i})).filter(({c})=>c.target&&!c.saved);
 const unique=new Set(selected.map(({c})=>c.target!.user_id)).size===selected.length;
 async function save(){
  if(busy||!confirmed||!selected.length||!unique)return;const version=generation.current;setBusy(true);setError('');setNotice('');
  try{
   for(const {c,i}of selected){
    if(version!==generation.current)return;
    const person=people[i],target=c.target!;let cutoutUrl:string|null=null;
    if(c.takePhoto&&c.cutout){
     const uploaded=await uploadStaffProfileCutout(seasonId,target.user_id,new File([c.cutout],'portrait.png',{type:'image/png'}));
     if(uploaded.error||!uploaded.cutoutUrl)throw Error(uploaded.error||'Freisteller konnte nicht gespeichert werden.');
     cutoutUrl=uploaded.cutoutUrl;
    }
    const [first,...last]=person.name.trim().split(/\s+/);
    const result=await supabase.rpc('import_oefb_staff_member',{
     p_team_season_id:seasonId,p_user_id:target.user_id,p_role:c.role,p_source_url:source,
     p_take_name:c.takeName,p_first_name:first,p_last_name:last.join(' '),
     p_take_photo:c.takePhoto&&!!person.photoUrl,p_photo_url:person.photoUrl,p_cutout_url:cutoutUrl,
    });
    if(result.error)throw Error(person.name+': '+result.error.message);
    if(version!==generation.current)return;
    patch(i,{saved:true});
   }
   setNotice('Ausgewählte Trainer und Fotos gespeichert.');setConfirmed(false);await onSaved();
  }catch(e){if(version===generation.current){setError((e instanceof Error?e.message:'Speichern fehlgeschlagen.')+' Bereits als gespeichert markierte Trainer bleiben gespeichert; offene Zuordnungen erneut bestätigen.');setConfirmed(false);}}
  finally{if(version===generation.current)setBusy(false);}
 }
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
  <h4 className="font-semibold">ÖFB-Trainer einlesen & verknüpfen</h4>
  <label className="block text-sm">ÖFB-Link „Trainer & Betreuer“<input type="url" value={url} disabled={busy} onChange={e=>{generation.current++;setUrl(e.target.value);setPeople([]);setChoices([]);setConfirmed(false);setError('');setNotice('');}} placeholder="https://vereine.oefb.at/…/Trainer-Betreuer" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"/></label>
  <button type="button" disabled={busy||!url.trim()} onClick={()=>void preview()} className="min-h-11 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?'Bitte warten…':'Trainer einlesen'}</button>
  {people.map((p,i)=>{const c=choices[i];const matches=staff.filter(s=>normalize(staffDisplayName(s))===normalize(p.name));const name=c.target?[c.target.first_name,c.target.last_name].filter(Boolean).join(' '):'';return <div key={p.name+'|'+p.sourceRole} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
   <div className="flex items-center gap-3"><OefbPlayerPhoto src={p.photoUrl} name={p.name}/><div><p className="font-semibold">{p.name}</p><p className="text-sm text-slate-500">{p.sourceRole}</p></div></div>
   {c.saved?<p role="status" className="text-sm font-semibold text-emerald-800">✓ Gespeichert</p>:<>
   {!c.target?matches.map(s=><button type="button" key={s.user_id} disabled={busy} onClick={()=>choose(i,s)} className="min-h-11 rounded-lg border border-slate-300 px-3 font-semibold">Mit {staffDisplayName(s)} verknüpfen</button>):<div className="rounded-lg bg-emerald-50 p-3 text-sm"><p>✓ {name||p.name} ausgewählt</p><button type="button" disabled={busy} className="underline" onClick={()=>patch(i,{target:null,cutout:null})}>Auswahl aufheben</button></div>}
   {!c.target&&!matches.length&&c.lookup?<div className="rounded-lg border border-slate-200 p-3"><p className="text-sm">Vorhandenes App-Konto gefunden: {c.email}</p><button type="button" disabled={busy} onClick={()=>choose(i,c.lookup!)} className="min-h-11 rounded-lg border px-3 font-semibold">Mit {[c.lookup.first_name,c.lookup.last_name].filter(Boolean).join(' ')||p.name} verknüpfen</button></div>:null}
   <details open={!matches.length&&!c.target&&!c.lookup}><summary className="cursor-pointer py-2 text-sm">Anderen Trainer auswählen</summary>
    <label className="block text-sm">Vorhandener Trainer<select value={c.target?.user_id||''} disabled={busy} onChange={e=>{const s=staff.find(s=>s.user_id===e.target.value);if(s)choose(i,s);}} className="min-h-11 w-full rounded-lg border p-2"><option value="">Bitte auswählen</option>{staff.map(s=><option key={s.user_id} value={s.user_id}>{staffDisplayName(s)}</option>)}</select></label>
    <label className="mt-2 block text-sm">E-Mail des bestehenden App-Kontos<input type="email" value={c.email} disabled={busy} onChange={e=>patch(i,{email:e.target.value,lookup:null})} className="min-h-11 w-full rounded-lg border p-2"/></label>
    <button type="button" disabled={busy||!c.email.trim()} onClick={()=>void lookup(i)} className="min-h-11 rounded-lg border px-3">Konto suchen</button>
    {c.lookup?<button type="button" disabled={busy} onClick={()=>choose(i,c.lookup!)} className="ml-2 min-h-11 rounded-lg border px-3">Mit {[c.lookup.first_name,c.lookup.last_name].filter(Boolean).join(' ')||c.email} verknüpfen</button>:null}
    <p className="text-xs text-slate-500">Kein neues Konto wird angelegt. Ohne App-Konto zuerst registrieren oder im Vereinssetup einladen.</p>
   </details>
   {c.target?<div className="space-y-2">
    <label className="block text-sm">Rolle in dieser Mannschaft<select value={c.role} disabled={busy} onChange={e=>patch(i,{role:e.target.value as Role})} className="ml-2 min-h-11 rounded-lg border p-2"><option value="head_coach">Cheftrainer</option><option value="trainer">Trainer</option><option value="co_trainer">Co-Trainer</option></select></label>
    {normalize(name)!==normalize(p.name)?<label className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm"><input type="checkbox" disabled={busy} checked={c.takeName} onChange={e=>patch(i,{takeName:e.target.checked})}/><span>Namen vom ÖFB übernehmen: <strong>{name||'App-Profil'} → {p.name}</strong><br/>Ändert das bestehende Profil auch in bisherigen Mannschaften.</span></label>:null}
    {p.photoUrl?<><label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={c.takePhoto} onChange={e=>patch(i,{takePhoto:e.target.checked})}/>ÖFB-Foto übernehmen (bisheriges Profilfoto ersetzen)</label><button type="button" disabled={busy} onClick={()=>void remove(i)} className="min-h-11 rounded-lg border px-3 font-semibold">Hintergrund entfernen</button></>:<p className="text-sm text-slate-500">Kein ÖFB-Foto gefunden. Eigenes Foto nach dem Speichern unter „Foto / Trainer bearbeiten“ hochladen.</p>}
    {c.cutout?<div className="space-y-2"><CutoutPreview blob={c.cutout}/><p className="text-sm">Vorschau prüfen. Das ÖFB-Original bleibt als Profilfoto erhalten; der Freisteller wird getrennt gespeichert.</p><button type="button" disabled={busy} onClick={()=>patch(i,{cutout:null})} className="underline">Freistellung verwerfen</button></div>:null}
   </div>:null}</>}
  </div>;})}
  {selected.length?<><label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Ich habe Mannschaft, Personen, Rollen und Fotoübernahme geprüft.</label>{!unique?<p role="alert" className="text-sm text-red-700">Ein App-Konto wurde mehrfach gewählt. Bitte jede Person eindeutig zuordnen.</p>:null}<button type="button" disabled={busy||!confirmed||!unique} onClick={()=>void save()} className="min-h-11 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Zuordnungen speichern ({selected.length})</button></>:null}
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
  {notice?<p role="status" className="text-sm text-slate-700">{notice}</p>:null}
 </section>;
}
