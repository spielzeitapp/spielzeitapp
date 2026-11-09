import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useSession} from '../../auth/useSession';
import {supabase} from '../../lib/supabaseClient';
import {shouldShowLifecycle,type LifecycleSnapshot} from '../../lib/seasonLifecycleAssistant';

export function SeasonLifecycleAssistant({seasonId,alwaysShow=false}:{seasonId?:string|null;alwaysShow?:boolean}) {
 const session=useSession();
 const authorized=[session.backendRole,session.membershipRole,session.effectiveRole].some(r=>['admin','trainer','head_coach','co_trainer','club_admin'].includes(String(r??'').toLowerCase()));
 const [rows,setRows]=useState<LifecycleSnapshot[]>([]),[edit,setEdit]=useState<LifecycleSnapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [confirmed,setConfirmed]=useState(false),[activate,setActivate]=useState(false),[players,setPlayers]=useState<string[]>([]),[age,setAge]=useState('');
 const version=useRef(0),scope=useRef(0);
 const refresh=useCallback(async()=>{if(!authorized)return;const current=++version.current;const r=await supabase.rpc('get_season_lifecycle',{p_source:seasonId??null});if(current!==version.current)return;
  if(r.error){if(r.error.code!=='42501')setMessage(r.error.message);return;}setRows(r.data??[]);
 },[authorized,seasonId]);
 useEffect(()=>{scope.current++;setBusy(false);setRows([]);setEdit(null);setMessage('');if(!authorized)return;void refresh();const f=()=>void refresh();window.addEventListener('focus',f);window.addEventListener('season-lifecycle-changed',f);const timer=window.setInterval(f,60000);return()=>{scope.current++;version.current++;window.clearInterval(timer);window.removeEventListener('focus',f);window.removeEventListener('season-lifecycle-changed',f);};},[refresh,authorized]);
 if(!authorized)return null;
 const visible=alwaysShow?rows:rows.filter(s=>shouldShowLifecycle(s));
 if(!visible.length&&!message)return null;
 async function open(s:LifecycleSnapshot){const current=scope.current;setBusy(true);setMessage('');try{const fresh=await supabase.rpc('get_season_lifecycle',{p_source:s.source_id});if(fresh.error)throw new Error(fresh.error.message);let data=fresh.data?.[0] as LifecycleSnapshot;if(!data)throw new Error('Saison nicht gefunden');if(!data.target_id){const r=await supabase.rpc('prepare_season_lifecycle',{p_source:s.source_id});if(r.error)throw new Error(r.error.message);data=r.data;}
  if(current!==scope.current)return;setEdit(data);setPlayers(data.roster.map(p=>p.id));setAge(data.target_age_group??data.next_age_group??'');setConfirmed(false);setActivate(false);await refresh();
 }catch(e){if(current===scope.current)setMessage(e instanceof Error?e.message:String(e));}finally{if(current===scope.current)setBusy(false);}}
 async function finish(){if(!edit||busy||!confirmed)return;const current=scope.current;setBusy(true);setMessage('');try{
  const r=await supabase.rpc('finish_season_lifecycle',{p_source:edit.source_id,p_target:edit.target_id,p_fingerprint:edit.fingerprint,p_confirm:true,p_activate:activate,p_players:players,p_age:age||null,p_enable_sync:false});
  if(r.error)throw new Error(r.error.message);if(current!==scope.current)return;const target=edit.target_id;setEdit(null);
  await session.reloadSessionTeamSeasons();if(current!==scope.current)return;
  if(seasonId&&target){if(activate)session.setSelectedTeamSeasonId(target);else session.setViewTeamSeasonId(target);}
  setMessage(activate?'Saison abgeschlossen. Die neue Saison ist aktiv.':'Saison abgeschlossen. Die Folgesaison ist vorbereitet; du kannst sie vor dem ersten neuen Termin aktivieren.');
  window.dispatchEvent(new Event('season-lifecycle-changed'));await refresh();
 }catch(e){if(current===scope.current){setMessage(e instanceof Error?e.message:String(e));await refresh();}}finally{if(current===scope.current)setBusy(false);}}
 async function snooze(s:LifecycleSnapshot){const current=scope.current;setBusy(true);try{const r=await supabase.rpc('snooze_season_lifecycle',{p_source:s.source_id});if(r.error)throw new Error(r.error.message);if(current===scope.current)await refresh();}catch(e){if(current===scope.current)setMessage(e instanceof Error?e.message:String(e));}finally{if(current===scope.current)setBusy(false);}}
 return <section className="my-4 space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm" aria-label="Saisonassistent">
  <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Saisonassistent</h2><button type="button" onClick={()=>void refresh()} disabled={busy} className="min-h-11 px-2 text-xs underline">Status prüfen</button></div>
  {message&&<p role="status">{message}</p>}
  {visible.length>0&&<details open={visible.length===1||undefined}><summary className="min-h-11 cursor-pointer py-2 font-semibold">{visible.length===1?'Saison prüfen':visible.length+' Mannschaften · Vorbereitung und Abschluss'}</summary><div className="space-y-3">{visible.map(s=><article key={s.source_id} className="rounded-xl border border-current/15 p-3">
   <p className="font-semibold">{s.club_name} · {s.team_name} · {s.season_name}</p>
   <p className="mt-1">{s.possible_end?'Mögliches Saisonende: Alle bekannten Pflichtspiele sind beendet.':s.target_status==='draft'?s.target_season_name+' ist vorbereitet. Die alte Saison bleibt bis zur Bestätigung erhalten.':'Die Folgesaison kann vorbereitet werden.'}</p>
   <p className="mt-1 text-xs opacity-75">{s.known_games} bekannte Pflichtspiele · {s.open_games} offen · {s.running_games} laufende Live-Spiele. Unbekannte Nachträge und einen unvollständigen Import ausdrücklich prüfen.</p>
   <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={busy||!s.next_season_name} onClick={()=>void open(s)} className="min-h-11 rounded-xl border px-3 font-semibold">{s.target_id?'Vorbereitung / Abschluss öffnen':'Folgesaison vorbereiten'}</button>{s.target_id&&<Link to={'/manager/saisons/'+encodeURIComponent(s.target_id)+'/oefb-import'} className="inline-flex min-h-11 items-center px-2 underline">Neuen Spielplan importieren</Link>}<button type="button" onClick={()=>void snooze(s)} disabled={busy} className="min-h-11 px-2 text-xs">In 7 Tagen erinnern</button></div>
  </article>)}</div></details>}
  {edit&&<div className="space-y-3 rounded-xl border border-current/20 p-4" role="region" aria-label="Saisonabschluss prüfen">
   <h3 className="font-bold">{edit.season_name} abschließen → {edit.target_season_name} vorbereiten</h3>
   <p>Alte Spiele, Statistiken und Fotos bleiben im Archiv. Es werden dieselben Spieler verwendet; keine neuen Spielerprofile und keine automatischen Einladungen. Trainer und bestehende Familienverknüpfungen werden passend zur Kaderauswahl übernommen.</p>
   <label className="block">Altersklasse der Folgesaison<input value={age} maxLength={30} disabled={busy} onChange={e=>setAge(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
   <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Kader prüfen · {players.length} von {edit.roster.length} übernehmen</summary><div className="max-h-60 overflow-auto">{edit.roster.map(p=><label key={p.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={players.includes(p.id)} disabled={busy} onChange={e=>setPlayers(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.number??'—'} · {p.name}{p.roster_status==='paused'?' · pausiert':''}</label>)}</div></details>
   <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" checked={activate} disabled={busy} onChange={e=>setActivate(e.target.checked)}/><span>Neue Saison jetzt aktivieren. Sonst bleibt sie als Entwurf vorbereitet.</span></label>
   <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy||edit.open_games>0||edit.running_games>0} onChange={e=>setConfirmed(e.target.checked)}/><span>Ich habe den vollständigen Spielplan einschließlich Nachtrags- und weiterer Bewerbsspiele, Kader und Altersklasse geprüft. Die alte Saison ist beendet.</span></label>
   {(edit.open_games>0||edit.running_games>0)&&<p role="status">Offene Pflichtspiele oder ein laufendes Live-Spiel verhindern den Abschluss. Die neue Saison kann bereits vorbereitet und ihr Spielplan importiert werden.</p>}
   <p className="text-xs opacity-75">ÖFB-Verknüpfung und kommende Termine werden vor dem Start separat geprüft. Vorbereitete ÖFB-Links sind noch nicht automatisch aktiviert.</p>
   <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!confirmed} onClick={()=>void finish()} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-40">{busy?'Speichert…':activate?'Abschließen & neue Saison starten':'Abschließen & Folgesaison vorbereiten'}</button><button type="button" disabled={busy} onClick={()=>setEdit(null)} className="min-h-11 px-3">Später</button><Link to="/manager/saisons/verwaltung" className="inline-flex min-h-11 items-center px-2 underline">Termine / Saisonverwaltung öffnen</Link></div>
  </div>}
 </section>;
}
