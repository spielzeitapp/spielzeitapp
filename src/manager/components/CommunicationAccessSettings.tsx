import React,{useEffect,useState} from 'react';
import {useSession} from '../../auth/useSession';
import {supabase} from '../../lib/supabaseClient';
type Row={user_id:string;speaker_enabled:boolean;music_enabled:boolean};
export function CommunicationAccessSettings({clubId,staff}:{clubId:string;staff:{user_id:string;first_name:string|null;last_name:string|null;roles:string[]}[]}){
 const {user,backendRole}=useSession();
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState<string|null>(null),[ready,setReady]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;setReady(false);void supabase.from('club_communication_access').select('user_id,speaker_enabled,music_enabled').eq('club_id',clubId).then(({data,error})=>{if(!active)return;if(error)setMessage('Freigaben konnten nicht geladen werden.');else{setRows(data??[]);setReady(true);setMessage('');}});return()=>{active=false;};},[clubId]);
 async function toggle(userId:string,key:'speaker_enabled'|'music_enabled'){
  if(busy||!ready)return;const old=rows.find(r=>r.user_id===userId)??{user_id:userId,speaker_enabled:false,music_enabled:false};
  const next={...old,[key]:!old[key]};setBusy(userId);setMessage('');
  const {data,error}=await supabase.from('club_communication_access').upsert({...next,club_id:clubId},{onConflict:'club_id,user_id'}).select('user_id,speaker_enabled,music_enabled').single();
  if(error||!data)setMessage('Speichern fehlgeschlagen. Freigabe nicht geändert.');else{setRows(current=>[...current.filter(r=>r.user_id!==userId),data]);setMessage('Freigabe gespeichert. Gilt nur für diesen Verein.');}setBusy(null);
 }
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900"><h2 className="text-base font-semibold">Musik & Spieltagsansagen · Personenfreigaben</h2><p className="mt-1 text-sm text-slate-600">Zwei Schalter pro Person. Ohne Freigabe sind beide Bereiche aus. Admins behalten Zugriff; andere Trainerrechte ändern sich nicht.</p>
 <div className="mt-4 space-y-3">{staff.map(s=>{const row=rows.find(r=>r.user_id===s.user_id);const admin=s.roles.includes('admin')||(s.user_id===user?.id&&backendRole==='admin');return <div key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><strong>{[s.first_name,s.last_name].filter(Boolean).join(' ')||'Vereinsmitglied'}</strong><div className="flex flex-wrap gap-2">{(['speaker_enabled','music_enabled'] as const).map(key=><button type="button" key={key} role="switch" aria-checked={admin||row?.[key]===true} disabled={admin||!ready||!!busy} onClick={()=>void toggle(s.user_id,key)} className={'min-h-11 rounded-full border px-4 text-sm font-semibold '+(admin||row?.[key]?'border-green-700 bg-green-700 text-white':'border-slate-300 bg-slate-100 text-slate-700')}>{key==='speaker_enabled'?'🎙 Spieltagsansagen':'♫ Musikplayer'} · {admin?'An · Admin':row?.[key]?'An':'Aus'}</button>)}</div></div>;})}</div>
 {!staff.length?<p className="mt-3 text-sm">Zuerst eine Person der Mannschaft zuordnen.</p>:null}<p role="status" className="mt-3 text-sm">{message}</p><p className="mt-2 text-xs text-slate-500">Online-Rechte werden spätestens nach 30 Sekunden erneut geprüft. Bereits heruntergeladene Offline-Kopien können nicht aus der Ferne gelöscht werden.</p></section>;
}
