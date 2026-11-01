import React,{useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {rosterIdentityMatches,rosterMembershipLabel,type ClubRosterProfile} from '../lib/clubRosterIdentity';
export function ManagerNewRosterPlayer({seasonId,onSaved}:{seasonId:string;onSaved:()=>void}) {
 const [first,setFirst]=useState(''),[last,setLast]=useState(''),[number,setNumber]=useState(''),[position,setPosition]=useState(''),[birthdate,setBirthdate]=useState('');
 const [matches,setMatches]=useState<ClubRosterProfile[]>([]),[choice,setChoice]=useState(''),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const reset=()=>{setMatches([]);setChoice('');setChecked(false);};
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  try {
   const {data,error}=await supabase.rpc('admin_club_roster_context',{p_team_season_id:seasonId});if(error)throw Error(error.message);
   const found=rosterIdentityMatches(data as ClubRosterProfile[],first,last);
   if(found.length && (!checked || !choice || (choice!=='new'&&!found.some(p=>p.id===choice)))){setMatches(found);setChecked(false);return;}
   const {error:saveError}=await supabase.rpc('admin_save_club_roster_player',{p_team_season_id:seasonId,p_player:{player_id:found.length&&choice!=='new'?choice:null,first_name:first.trim(),last_name:last.trim(),jersey_number:number||null,position,birthdate:birthdate||null,distinct_person:found.length>0&&choice==='new'&&checked}});
   if(saveError)throw Error(saveError.message);
   setNotice(choice&&choice!=='new'?'Vorhandenes Profil zusätzlich zugeordnet. Bisherige Mannschaften bleiben erhalten.':'Spieler angelegt.');
   setFirst('');setLast('');setNumber('');setPosition('');setBirthdate('');reset();onSaved();window.dispatchEvent(new Event('manager-setup-changed'));
  }catch(e){setError(e instanceof Error?e.message:'Speichern fehlgeschlagen');}finally{setBusy(false);}
 }
 return <form onSubmit={e=>void save(e)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
  <h2 className="font-semibold">Spieler zum Kader hinzufügen</h2>
  <div className="grid gap-3 sm:grid-cols-2">
   <label>Vorname *<input required maxLength={100} disabled={busy} value={first} onChange={e=>{setFirst(e.target.value);reset();}} className="mt-1 w-full rounded-lg border p-2" /></label>
   <label>Nachname *<input required maxLength={100} disabled={busy} value={last} onChange={e=>{setLast(e.target.value);reset();}} className="mt-1 w-full rounded-lg border p-2" /></label>
   <label>Rückennummer<input type="number" min="1" max="999" disabled={busy} value={number} onChange={e=>setNumber(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
   <label>Position<input disabled={busy} value={position} onChange={e=>setPosition(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
   <label>Geburtsdatum (optional)<input type="date" disabled={busy} value={birthdate} onChange={e=>setBirthdate(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
  </div>
  {matches.length>0?<div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
   <p className="font-semibold">Möglicherweise bereits im Verein vorhanden</p>
   <p className="text-sm">Gleiche Namen können verschiedene Personen sein. Bitte Identität prüfen. Das bestehende Profil kann zusätzlich zugeordnet werden. Name, Geburtsdatum und Foto bleiben dabei unverändert.</p>
   {matches.map(p=><label key={p.id} className="block text-sm"><input type="radio" disabled={busy} checked={choice===p.id} onChange={()=>{setChoice(p.id);setChecked(false);}} /> {p.first_name} {p.last_name} · {rosterMembershipLabel(p)}</label>)}
   <label className="block text-sm"><input type="radio" disabled={busy} checked={choice==='new'} onChange={()=>{setChoice('new');setChecked(false);}} /> Andere Person mit gleichem Namen – neues Profil anlegen</label>
   <label className="block text-sm"><input type="checkbox" disabled={busy||!choice} checked={checked} onChange={e=>setChecked(e.target.checked)} /> Identität und zusätzliche Zuordnung geprüft</label>
  </div>:null}
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}{notice?<p role="status" className="text-sm text-emerald-700">{notice}</p>:null}
  <button disabled={busy} className="min-h-11 rounded-lg bg-red-700 px-4 font-semibold text-white disabled:opacity-50">{busy?'Wird geprüft…':matches.length?'Auswahl bestätigen und speichern':'Prüfen und Spieler anlegen'}</button>
 </form>;
}
