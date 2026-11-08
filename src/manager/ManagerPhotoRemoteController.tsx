import React,{useEffect,useRef,useState} from 'react';
import type {RosterPlayer} from '../lib/rosterService';
import {PHOTO_STEPS,PHOTO_LABELS,type PhotoStep} from '../lib/playerPhotoMotifs';
import {createRemoteSession,readRemoteSession,updateRemoteSession,closeRemoteSession,remoteCameraOnline,type RemoteSession,type RemoteAction} from '../lib/playerPhotoRemote';
import {ManagerProfilePhotoPreview} from './ManagerProfilePhotoPreview';
export function ManagerPhotoRemoteController({seasonId,players,onClose}:{seasonId:string;players:RosterPlayer[];onClose:()=>void}){
 const [session,setSession]=useState<RemoteSession|null>(null),[qr,setQr]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState<string|null>(null),[showQr,setShowQr]=useState(true);
 const [chosen,setChosen]=useState(players[0]?.id??''),[step,setStep]=useState<PhotoStep>('portrait');
 const lastCommand=useRef<string|null>(null),pendingSince=useRef(0);
 const state=session?.state,player=players.find(p=>p.id===state?.playerId);
 const online=session?remoteCameraOnline(session):false;
 const available=online&&Boolean(state)&&!state?.busy&&!state?.finished&&!busy&&!pending;
 const connectUrl=session?`${window.location.origin}/manager/saisons/${encodeURIComponent(seasonId)}/kader?fotoboxCamera=${session.id}`:'';
 useEffect(()=>{if(!connectUrl){setQr('');return;}let active=true;void import('qrcode').then(q=>q.toDataURL(connectUrl,{width:280,margin:2})).then(url=>{if(active)setQr(url);}).catch(()=>{if(active)setError('QR-Code nicht verfügbar. Den Kopplungslink am Stativgerät öffnen.');});return()=>{active=false;};},[connectUrl]);
 useEffect(()=>{
  if(!session?.id)return;let active=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const next=await readRemoteSession(session.id);if(!active)return;setSession(next);setError('');
   if(lastCommand.current&&!next.command){lastCommand.current=null;setPending(null);}
   if(lastCommand.current&&next.ack===lastCommand.current&&next.state?.handled===lastCommand.current){lastCommand.current=null;setPending(null);}
   else if(lastCommand.current&&Date.now()-pendingSince.current>45000){setPending(null);setError('Noch keine Bestätigung von der Kamera. Verbindung prüfen; die letzte Aktion wird nicht automatisch wiederholt.');}
   if(next.state){setChosen(next.state.playerId);setStep(next.state.step);}
  }catch(e){if(active)setError((e as Error).message);}finally{if(active)timer=setTimeout(poll,1200);}};
  void poll();return()=>{active=false;clearTimeout(timer);};
 },[session?.id]);
 async function create(){if(busy)return;setBusy(true);setError('');try{setSession(await createRemoteSession(seasonId));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function send(action:RemoteAction,nextPlayer=state?.playerId,nextStep=state?.step){
  if(!session||!available||!state||!nextPlayer||!nextStep)return;
  const command={id:crypto.randomUUID(),action,playerId:nextPlayer,step:nextStep,draftId:state.draftId};
  setBusy(true);setError('');lastCommand.current=command.id;pendingSince.current=Date.now();setPending(command.id);
  try{await updateRemoteSession(session.id,{command});}catch(e){lastCommand.current=null;setPending(null);setError((e as Error).message);}finally{setBusy(false);}
 }
 async function end(){if(busy)return;setBusy(true);try{if(session)await closeRemoteSession(session.id);setSession(null);onClose();}catch(e){setError((e as Error).message);setBusy(false);}}
 return <section className="manager-player-fotobox rounded-2xl border border-slate-200 bg-white p-4 text-slate-900" aria-label="Fotobox-Fernsteuerung">
 <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Fotobox · Fernsteuerung</h2><button type="button" disabled={busy} onClick={()=>void end()} className="min-h-11 rounded-xl border px-4">{session?'Verbindung beenden':'Schließen'}</button></header>
 {!session?<><p className="my-3">Dieses Gerät ist die Fernsteuerung – hier wählst du Spieler und löst das Foto aus. Das zweite Gerät fotografiert am Stativ. Handy und iPad können beide Rollen übernehmen. Auf beiden Geräten mit demselben Manager-Konto anmelden und geöffnet lassen.</p><button type="button" disabled={busy} onClick={()=>void create()} className="min-h-12 rounded-xl bg-red-700 px-4 py-3 font-bold text-white">{busy?'Verbindung wird vorbereitet…':'Stativkamera verbinden · QR-Code anzeigen'}</button></>:<>
 <p role="status" className={`my-3 rounded-xl p-3 font-semibold ${online?'bg-emerald-50 text-emerald-900':'bg-amber-50 text-amber-900'}`}>{online?'Kamera verbunden':session.camera_id?'Kamera antwortet nicht · Stativgerät entsperren und Fotobox geöffnet lassen':'Warte auf Stativkamera'}</p>
 <button type="button" className="mb-2 min-h-11 underline" onClick={()=>setShowQr(v=>!v)}>{showQr?'Kopplung ausblenden':'QR-Code / Kopplungslink anzeigen'}</button>
 {showQr&&<div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-3">{qr&&<img src={qr} width={180} height={180} alt="QR-Code mit dem Stativgerät scannen"/>}<div className="min-w-0 flex-1"><p className="font-semibold">1. Am Stativgerät die normale Kamera öffnen und diesen QR-Code scannen.</p><p className="mt-2 text-sm">2. Dort „Kamera verbinden“ drücken und den Kamerazugriff erlauben. 3. Hier auf „Foto auslösen“ drücken. Auf beiden Geräten dasselbe Manager-Konto verwenden.</p><a href={connectUrl} className="mt-3 block break-all text-xs underline">Kopplungslink</a><p className="mt-2 text-xs">Sitzung gültig bis {new Date(session.expires_at).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}. Nur für dieses Manager-Konto.</p></div></div>}
 <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)]">
 <div className="min-w-0 rounded-xl bg-slate-100 p-2">{state?.original&&player?<ManagerProfilePhotoPreview seasonId={seasonId} layout={state.layout} photoUrl={state.original} cutoutUrl={state.cutout??null} firstName={player.first_name??''} lastName={player.last_name??''} number={player.jersey_number} trainer={false} clubTemplate={player.club_photo_template} clubDesign={player.club_profile_design}/>:<div className="flex min-h-64 items-center justify-center p-6 text-center text-slate-600">{state?.finished?'Fotoserie abgeschlossen':state?.busy?'Kamera verarbeitet das Foto…':'Nach dem Auslösen erscheint hier die Aufnahme im Vereinslook.'}</div>}</div>
 <div className="space-y-3"><label className="block font-semibold">Spieler<select aria-label="Fernsteuerung Spieler" value={chosen} disabled={!available||Boolean(state?.draftId)} onChange={e=>{setChosen(e.target.value);void send('select',e.target.value,step);}} className="mt-1 min-h-12 w-full rounded-xl border bg-white p-3">{players.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.jersey_number??'–'}</option>)}</select></label>
 <div className="flex flex-wrap gap-1">{PHOTO_STEPS.map(s=><button type="button" key={s} disabled={!available||Boolean(state?.draftId)} aria-pressed={step===s} onClick={()=>{setStep(s);void send('select',chosen,s);}} className={`min-h-11 flex-1 rounded-lg border px-2 text-sm font-semibold ${step===s?'bg-red-700 text-white':''}`}>{PHOTO_LABELS[s]}</button>)}</div>
 <p role="status" className="text-sm font-semibold">{pending?'Aktion wird an die Kamera gesendet…':state?.busy?'Bitte warten · Kamera arbeitet':state?.draftId?'Foto aufgenommen · noch nicht gespeichert':state?.finished?'Fertig · alle Schritte durchlaufen':'Bereit für die nächste Aufnahme'}</p>
 {state?.draftId?<><button type="button" disabled={!available||!state.original} onClick={()=>void send('accept')} className="min-h-12 w-full rounded-xl bg-red-700 p-3 font-bold text-white disabled:opacity-40">Übernehmen</button><button type="button" disabled={!available} onClick={()=>void send('retake')} className="min-h-12 w-full rounded-xl border p-3 font-semibold disabled:opacity-40">Noch einmal</button></>:<button type="button" disabled={!available||!state?.ready} onClick={()=>void send('capture')} className="min-h-12 w-full rounded-xl bg-red-700 p-3 font-bold text-white disabled:opacity-40">Foto auslösen</button>}
 {!state?.draftId&&<button type="button" disabled={!available} onClick={()=>void send('skip')} className="min-h-11 w-full rounded-xl border p-3 disabled:opacity-40">Schritt überspringen</button>}
 <p className="text-sm">Nach dem Übernehmen: Profil → Spieltag → Jubel → nächster Spieler. Das Original in voller Qualität bleibt bis zum Speichern auf dem Stativgerät.</p>
 {state?.notice&&<p className="rounded-xl bg-emerald-50 p-3 text-sm">{state.notice}</p>}{state?.error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
 </div></div></>}
 {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 </section>;
}
