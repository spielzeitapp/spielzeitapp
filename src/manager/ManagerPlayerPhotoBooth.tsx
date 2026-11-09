import {savePhotoOnDevice} from '../lib/savePhotoOnDevice';
import {photoCountdown} from '../lib/photoCountdown';
import {managerPortalRoot} from '../lib/managerPortal';
import {usePhotoRemoteCamera} from './usePhotoRemoteCamera';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Camera,RefreshCw,ImagePlus,X,Check,SwitchCamera} from 'lucide-react';
import type {RosterPlayer} from '../lib/rosterService';
import {PHOTO_STEPS,PHOTO_LABELS,listPlayerPhotoMotifs,uploadPlayerMotif,savePlayerPhotoMotif,type PhotoStep,type PlayerPhotoMotif} from '../lib/playerPhotoMotifs';
import {DEFAULT_PHOTO_LAYOUT} from '../lib/playerPhotoLayout';
import {startLivePlayerPortrait} from '../lib/livePlayerPortrait';
import './managerPlayerPhotoBooth.css';
import {photoBoothFile,photoBoothImportFile} from '../lib/playerPhotoBooth';
import {removePortraitBackground} from '../lib/removePortraitBackground';
import {uploadPlayerProfilePhoto,uploadPlayerProfileCutout} from '../lib/profileCutoutUpload';
import {getTeamSeasonWritableState} from '../lib/seasonTransition';
import {supabase} from '../lib/supabaseClient';
import {ManagerProfilePhotoPreview} from './ManagerProfilePhotoPreview';
import {useUnsavedProfileGuard} from './useUnsavedProfileGuard';

type Draft={id:string;file:File;url:string;cutout:Blob|null;cutoutUrl:string|null};
export function ManagerPlayerPhotoBooth({seasonId,players,initialPlayerId,initialStep='portrait',onSaved,onClose,remoteSessionId}:{remoteSessionId?:string;seasonId:string;players:RosterPlayer[];initialPlayerId?:string;initialStep?:PhotoStep;onSaved:()=>void|Promise<void>;onClose:()=>void}) {
 const [selected,setSelected]=useState(players.find(p=>p.id===initialPlayerId)?.id??players[0]?.id??'');
 const [mode,setMode]=useState<PhotoStep>(initialStep),[facing,setFacing]=useState<'environment'|'user'>('environment');
 const [draft,setDraft]=useState<Draft|null>(null),[processing,setProcessing]=useState(false),[saving,setSaving]=useState(false);
 const [cameraReady,setCameraReady]=useState(false),[cameraError,setCameraError]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [live,setLive]=useState(false),[liveFrame,setLiveFrame]=useState(''),[liveError,setLiveError]=useState('');
 const [deviceCopy,setDeviceCopy]=useState(false),[localPhoto,setLocalPhoto]=useState<File|null>(null),[exporting,setExporting]=useState(false),[exportStatus,setExportStatus]=useState('');
 const [timerSeconds,setTimerSeconds]=useState(3),[countdown,setCountdown]=useState<number|null>(null);
 const countdownController=useRef<AbortController|null>(null);
 const [autoNext,setAutoNext]=useState(true),[restart,setRestart]=useState(0),[remove,setRemove]=useState(false);
 const [motifs,setMotifs]=useState<PlayerPhotoMotif[]>([]),[motifsReady,setMotifsReady]=useState(false),[finished,setFinished]=useState(false);
 const [results,setResults]=useState<Record<string,'saved'|'skipped'>>({});
 useEffect(()=>{let active=true;void listPlayerPhotoMotifs(seasonId).then(data=>{if(active){setMotifs(data);setMotifsReady(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[seasonId]);
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),dialog=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const version=useRef(0),locked=useRef(false),mounted=useRef(true),busy=processing||saving;
 const player=players.find(p=>p.id===selected),index=players.findIndex(p=>p.id===selected);
 const template=player?.club_photo_template??'wide',aspect=template==='square'?1:4/3;
 const guideHeight=400/aspect,headY=guideHeight*.28;
 const guidePath=mode!=='celebration'?`M160 ${headY} a40 50 0 1 0 80 0 a40 50 0 1 0 -80 0 M160 ${headY+45} L150 ${headY+65} Q80 ${headY+80} 75 ${guideHeight*.9} M240 ${headY+45} L250 ${headY+65} Q320 ${headY+80} 325 ${guideHeight*.9}`:`M170 ${headY+20} a30 38 0 1 0 60 0 a30 38 0 1 0 -60 0 M170 ${headY+55} L145 ${headY+75} L85 ${guideHeight*.3} L65 ${guideHeight*.1} M230 ${headY+55} L255 ${headY+75} L315 ${guideHeight*.3} L335 ${guideHeight*.1} M145 ${headY+75} L140 ${guideHeight*.94} L260 ${guideHeight*.94} L255 ${headY+75}`;
 const layout={...DEFAULT_PHOTO_LAYOUT,...(player?.photo_layout??player?.photo_layout_default),rotation:0 as const,zoom:100,x:50,y:50,source:draft?.cutout?'cutout' as const:'original' as const};
 useUnsavedProfileGuard(Boolean(draft)||busy,'Das aufgenommene Foto ist noch nicht gespeichert. Fotobox verlassen?',false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;countdownController.current?.abort();version.current++;};},[]);
 useEffect(()=>()=>{if(draft){URL.revokeObjectURL(draft.url);if(draft.cutoutUrl)URL.revokeObjectURL(draft.cutoutUrl);}},[draft]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialog.current?.focus();
  return()=>{document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 useEffect(()=>{
  setCameraReady(false);setCameraError('');if(draft||finished||localPhoto)return;
  let active=true;
  const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;};
  if(!navigator.mediaDevices?.getUserMedia){setCameraError('Livekamera nicht verfügbar. Nutze „Kamera / Bild auswählen“.');return;}
  void navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1920}},audio:false}).then(async media=>{
   if(!active||document.hidden){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;if(video.current){video.current.srcObject=media;await video.current.play();}
  }).catch(()=>{if(active)setCameraError('Kamera konnte nicht geöffnet werden. Bitte Kamerazugriff erlauben oder „Kamera / Bild auswählen“ nutzen.');});
  const visibility=()=>{if(document.hidden){countdownController.current?.abort();stop();setCameraReady(false);setCameraError('Kamera pausiert. Zum Fortsetzen „Kamera neu starten“ wählen.');}};
  document.addEventListener('visibilitychange',visibility);
  return()=>{active=false;stop();document.removeEventListener('visibilitychange',visibility);};
 },[draft,facing,restart,finished,localPhoto]);
 useEffect(()=>{
  setLiveFrame('');setLiveError('');
  if(!live||!remove||!cameraReady||draft||busy||!video.current)return;
  return startLivePlayerPortrait(video.current,aspect,facing==='user',setLiveFrame,()=>{setLiveFrame('');setLiveError('Live-Hintergrund hier nicht verfügbar. Das Foto wird nach der Aufnahme freigestellt.');});
 },[live,remove,cameraReady,draft,busy,aspect,facing,selected]);
 const close=()=>{if(saving||exporting)return;if(localPhoto&&!window.confirm('Das Foto ist in der App gespeichert. Ohne zusätzliche Gerätekopie schließen?'))return;if((draft||(processing&&countdown===null))&&!window.confirm('Aufgenommenes Foto verwerfen?'))return;countdownController.current?.abort();onClose();};
 const discard=()=>{version.current++;setDraft(null);setError('');setNotice('');};
 async function prepare(file:File){
  const token=++version.current;setError('');setNotice('');let cutout:Blob|null=null,cutoutUrl:string|null=null;
  const url=URL.createObjectURL(file);
  try{if(remove){try{cutout=await removePortraitBackground(url,'gentle');cutoutUrl=URL.createObjectURL(cutout);}catch{if(token===version.current)setNotice('Freistellung nicht möglich. Du kannst das Original übernehmen oder noch einmal fotografieren.');}}
   if(!mounted.current||token!==version.current){URL.revokeObjectURL(url);if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);return;}
   setDraft({id:crypto.randomUUID(),file,url,cutout,cutoutUrl});
  }catch(e){URL.revokeObjectURL(url);throw e;}
 }
 async function capture(){
  if(locked.current||!video.current||!cameraReady||draft||finished||document.hidden)return;
  locked.current=true;setProcessing(true);setError('');
  const controller=new AbortController();countdownController.current=controller;
  try{
   await photoCountdown(timerSeconds,controller.signal,setCountdown);
   setCountdown(null);
   const v=video.current;
   if(!mounted.current||document.hidden||!v||v.readyState<2||!stream.current?.active)return;
   const file=await photoBoothFile(v,v.videoWidth,v.videoHeight,aspect,facing==='user');
   if(mounted.current&&!controller.signal.aborted)await prepare(file);
  }catch(e){if(!controller.signal.aborted&&mounted.current)setError(e instanceof Error?e.message:'Aufnahme fehlgeschlagen.');}
  finally{countdownController.current=null;locked.current=false;if(mounted.current){setCountdown(null);setProcessing(false);}}
 }
 async function choose(file?:File){
  if(!file||locked.current)return;locked.current=true;setProcessing(true);setError('');
  let url='';
  try{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Bitte JPG, PNG oder WebP bis 20 MB auswählen.');
   url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
   const normalized=await photoBoothImportFile(image,image.naturalWidth,image.naturalHeight);if(mounted.current)await prepare(normalized);
  }catch(e){setError(e instanceof Error?e.message:'Foto konnte nicht geöffnet werden.');}finally{if(url)URL.revokeObjectURL(url);locked.current=false;setProcessing(false);}
 }
 function advance(outcome:'saved'|'skipped'){
  setResults(old=>({...old,[`${selected}:${mode}`]:outcome}));
  if(!autoNext)return;
  const step=PHOTO_STEPS.indexOf(mode);
  if(step<PHOTO_STEPS.length-1)setMode(PHOTO_STEPS[step+1]);
  else if(index<players.length-1){setSelected(players[index+1].id);setMode('portrait');}
  else setFinished(true);
 }
 async function save(){
  if(!player||!draft||locked.current)return;locked.current=true;setSaving(true);setError('');
  try{
   const writable=await getTeamSeasonWritableState(seasonId);if('error' in writable||!writable.writable)throw Error('error' in writable?writable.error:writable.message);
   if(!motifsReady)throw Error('Zusatzfotos noch nicht geladen. Bitte Fotobox schließen und erneut öffnen.');
   if(mode!=='portrait'){
    const current=motifs.find(m=>m.player_id===player.id&&m.purpose===mode);
    const original_url=await uploadPlayerMotif(seasonId,player.id,mode,draft.file);
    const cutout_url=draft.cutout?await uploadPlayerMotif(seasonId,player.id,mode,draft.cutout,true):null;
    const saved=await savePlayerPhotoMotif({team_season_id:seasonId,player_id:player.id,purpose:mode,original_url,cutout_url,layout},current?.revision??null);
    setMotifs(old=>[...old.filter(m=>!(m.player_id===saved.player_id&&m.purpose===saved.purpose)),saved]);
   }else{
   const original=await uploadPlayerProfilePhoto(seasonId,player.id,draft.file);if(original.error||!original.avatarUrl)throw Error(original.error||'Foto konnte nicht gespeichert werden.');
   let cutoutUrl:string|null=null;
   if(draft.cutout){const uploaded=await uploadPlayerProfileCutout(seasonId,player.id,new File([draft.cutout],'freisteller.png',{type:'image/png'}));if(uploaded.error||!uploaded.cutoutUrl)throw Error(uploaded.error||'Freisteller konnte nicht gespeichert werden.');cutoutUrl=uploaded.cutoutUrl;}
   const avatar=await supabase.from('player_avatars').upsert({player_id:player.id,avatar_url:original.avatarUrl,updated_at:new Date().toISOString()},{onConflict:'player_id'});if(avatar.error)throw avatar.error;
   const updated=await supabase.from('players').update({cutout_url:cutoutUrl}).eq('id',player.id).select('id').single();if(updated.error||!updated.data)throw Error(updated.error?.message||'Keine Berechtigung zum Speichern.');
   const result=await supabase.rpc('admin_save_player_photo_layout',{p_team_season_id:seasonId,p_player_id:player.id,p_layout:layout,p_expected:player.photo_layout??null});if(result.error)throw result.error;
   }
   await onSaved();setDraft(null);window.dispatchEvent(new Event('manager-setup-changed'));
   setNotice(`${PHOTO_LABELS[mode]} für ${player.display_name} gespeichert. Später unter Foto gestalten bearbeiten.`);
   if(deviceCopy){
    const suffix=draft.file.type==='image/png'?'png':draft.file.type==='image/webp'?'webp':'jpg';
    const name=player.display_name.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)||'Spieler';
    setLocalPhoto(new File([draft.file],`${name}-${PHOTO_LABELS[mode]}.${suffix}`,{type:draft.file.type}));
    setExportStatus('');
   }else advance('saved');
  }catch(e){setError((e as {message?:string}).message||'Speichern fehlgeschlagen. Bitte erneut versuchen.');}finally{locked.current=false;setSaving(false);}
 }
 const remote=usePhotoRemoteCamera(remoteSessionId,seasonId,{playerId:selected,step:mode,ready:cameraReady,busy:busy||locked.current||Boolean(localPhoto),draftId:draft?.id??null,finished,error,notice:localPhoto?'In App gespeichert · am Stativgerät Bild sichern oder Weiter wählen':countdown!==null?'Countdown läuft am Stativgerät · Pose halten':notice,layout},draft?.file??null,draft?.cutout??null,async command=>{
  if(locked.current)throw Error('Die Kamera arbeitet noch. Bitte kurz warten.');
  if(command.action==='capture')await capture();
  else if(command.action==='accept')await save();
  else if(command.action==='retake')discard();
  else if(command.action==='skip')advance('skipped');
  else if(command.action==='select'){
   if(!players.some(p=>p.id===command.playerId))throw Error('Spieler nicht im aktiven Kader.');
   setSelected(command.playerId);setMode(command.step);setNotice('');setError('');
  }
 });
 useEffect(()=>{if(!remote.ended)return;countdownController.current?.abort();stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCameraReady(false);setCameraError(remote.error||'Fernsteuerung beendet. Fotobox schließen und neu verbinden.');},[remote.ended]);
 return createPortal(<div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/80 p-0 sm:p-4" onKeyDown={e=>{
  if(e.key==='Escape'){e.stopPropagation();close();}
  if(e.key==='Tab'){const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary,[tabindex="0"]')??[]).filter(node=>node.getClientRects().length>0);if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }}><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fotobox-title" aria-busy={busy} className="manager-player-fotobox mx-auto min-h-full w-full max-w-lg bg-white text-slate-900 sm:min-h-0 sm:overflow-hidden sm:rounded-2xl" style={{paddingBottom:'max(16px, env(safe-area-inset-bottom))'}}>
  <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[#292c31] p-4 text-white" style={{paddingTop:'calc(16px + env(safe-area-inset-top, 0px))',paddingLeft:'max(16px, env(safe-area-inset-left, 0px))',paddingRight:'max(16px, env(safe-area-inset-right, 0px))'}}><div><h2 id="fotobox-title" className="text-xl font-bold">{draft?'Foto prüfen':'Spieler-Fotobox'}</h2><p className="text-xs text-slate-300">{draft?'Vorschau im Vereinslook':'Aufnehmen · prüfen · übernehmen'}</p></div><button type="button" aria-label="Fotobox schließen" disabled={saving||exporting} onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25"><X/></button></header>
  {remoteSessionId&&<p role="status" className={`p-3 text-sm font-semibold ${remote.connected?'bg-emerald-50 text-emerald-900':'bg-amber-50 text-amber-900'}`}>{remote.connected?'Mit Fernsteuerung verbunden · Kamera geöffnet lassen':remote.error||'Verbindung zur Fernsteuerung wird hergestellt…'}</p>}
  <div className={!draft&&!finished&&!localPhoto?'space-y-2 p-3':'space-y-4 p-4'}><label className="block text-sm font-semibold">Spieler · {index+1} von {players.length}<select aria-label="Spieler auswählen" value={selected} disabled={busy||Boolean(draft)||Boolean(localPhoto)} onChange={e=>{setSelected(e.target.value);setMode('portrait');setNotice('');setFinished(false);}} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base font-semibold text-slate-900">{players.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.jersey_number??'–'}</option>)}</select></label>
  {finished?<section className="space-y-3 rounded-xl bg-emerald-50 p-4" role="status"><h3 className="text-lg font-bold">Fotoserie abgeschlossen</h3><p>{Object.values(results).filter(v=>v==='saved').length} Fotos gespeichert · {Object.values(results).filter(v=>v==='skipped').length} Schritte übersprungen.</p><p className="text-sm">Profil-, Spieltag- und Jubelfotos sind getrennt gespeichert. Freistellen, Helligkeit und Ausschnitt kannst du unter „Foto gestalten“ bearbeiten.</p><button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white">Fertig</button></section>:localPhoto?<section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
   <h3 className="text-lg font-bold">In der App gespeichert</h3>
   <p className="text-sm">Jetzt das Originalfoto zusätzlich auf diesem Gerät sichern. Am iPhone/iPad im Teilen-Menü „Bild sichern“ wählen.</p>
   <button type="button" disabled={exporting} onClick={()=>{setExporting(true);setExportStatus('');void savePhotoOnDevice(localPhoto).then(result=>setExportStatus(result==='shared'?'Teilen-Menü geschlossen. Mit „Weiter“ fortsetzen.':result==='aborted'?'Export abgebrochen. Das Foto bleibt in der App gespeichert.':'Download gestartet. Das Foto bleibt in der App gespeichert.')).catch(()=>setExportStatus('Export nicht möglich. Bitte erneut versuchen. Das Foto ist in der App gespeichert.')).finally(()=>setExporting(false));}} className="min-h-12 w-full rounded-xl bg-red-700 px-4 font-bold text-white">{exporting?'Export geöffnet…':'Bild sichern'}</button>
   {exportStatus&&<p role="status" className="text-sm">{exportStatus}</p>}
   <button type="button" disabled={exporting} onClick={()=>{setLocalPhoto(null);setExportStatus('');advance('saved');}} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white font-semibold">Weiter</button>
  </section>:!draft?<>
   <div className="flex rounded-xl bg-slate-100 p-1">{PHOTO_STEPS.map(value=><button type="button" key={value} aria-pressed={mode===value} disabled={busy} onClick={()=>setMode(value)} className={`min-h-11 flex-1 rounded-lg font-semibold ${mode===value?'bg-red-700 text-white':''}`}>{PHOTO_LABELS[value]}</button>)}</div>
   <div data-central-preserve className="relative mx-auto overflow-hidden rounded-2xl bg-slate-900" style={{aspectRatio:aspect,width:`min(100%, max(180px, calc((100dvh - 340px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * ${aspect})))`}}>
    <video ref={video} autoPlay playsInline muted onLoadedData={()=>setCameraReady(true)} aria-label="Livekamera" className="absolute inset-0 h-full w-full object-cover" style={{transform:facing==='user'?'scaleX(-1)':undefined}}/>
    {live&&remove&&liveFrame&&player&&<div className="fotobox-live-preview absolute inset-0"><ManagerProfilePhotoPreview seasonId={seasonId} layout={{...layout,source:'cutout'}} photoUrl={liveFrame} cutoutUrl={liveFrame} firstName={player.first_name??''} lastName={player.last_name??''} number={player.jersey_number} trainer={false} clubTemplate={template} clubDesign={player.club_profile_design}/></div>}
    {!liveFrame&&<svg aria-hidden="true" viewBox={`0 0 400 ${guideHeight}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{filter:'drop-shadow(0 1px 2px #000)'}}><rect x="20" y="16" width="360" height={guideHeight-32} rx="12" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 6"/><path d={guidePath} fill="none" stroke="white" strokeWidth="2"/></svg>}
    {countdown!==null&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 text-white"><span role="status" aria-live="assertive" aria-atomic="true" className="text-[56px] font-black leading-none drop-shadow-lg">{countdown}</span><span className="mt-1 rounded-full bg-black/70 px-2 py-1 text-xs font-bold">Pose halten</span><button type="button" onClick={()=>countdownController.current?.abort()} className="mt-1 min-h-11 rounded-xl bg-white px-5 font-bold text-slate-900">Countdown abbrechen</button></div>}
    <p className="pointer-events-none absolute inset-x-2 top-2 rounded-lg bg-black/65 px-3 py-1.5 text-center text-xs font-semibold text-white">{mode==='portrait'?'Kopf in die Schablone':mode==='matchday'?'Oberkörper und Arme im Rahmen':'Beide Hände im Rahmen'}</p>
    {cameraError&&<div className="absolute inset-x-3 bottom-3 rounded-xl bg-white p-3 text-sm"><p role="status">{cameraError}</p><button type="button" disabled={busy} onClick={()=>setRestart(n=>n+1)} className="mt-2 min-h-11 w-full rounded-lg bg-red-700 px-3 font-bold text-white">Kamera neu starten</button></div>}
   </div>
   <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm" style={{paddingBottom:'max(8px, env(safe-area-inset-bottom, 0px))'}}><button type="button" aria-label="Kamera / Bild auswählen" disabled={busy} onClick={()=>fileInput.current?.click()} className="flex min-h-11 flex-col items-center gap-1 p-2 text-xs"><ImagePlus/>Kamera / Bild</button><button type="button" aria-label="Foto aufnehmen" disabled={busy||!cameraReady} onClick={()=>void capture()} className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-200 bg-red-700 text-white disabled:opacity-40"><Camera size={30}/></button><button type="button" aria-label="Kamera wechseln" disabled={busy} onClick={()=>setFacing(f=>f==='user'?'environment':'user')} className="flex min-h-11 flex-col items-center gap-1 p-2 text-xs"><SwitchCamera/>Wechseln</button></div>
   <details className="rounded-xl border border-slate-200 p-3"><summary className="min-h-8 cursor-pointer text-sm font-semibold">Einstellungen · Selbstauslöser {timerSeconds?timerSeconds+' s':'aus'}</summary><div className="mt-3 space-y-3">
   <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 p-3 text-base font-semibold"><input aria-label="Vereinslook live anzeigen" type="checkbox" checked={live} disabled={busy||!remove} onChange={e=>setLive(e.target.checked)}/>Vereinslook live anzeigen · optional</label>
   {live&&remove&&!liveFrame&&cameraReady&&!liveError&&<p role="status" className="text-sm text-slate-700">Live-Vorschau wird geladen… Du kannst bereits fotografieren.</p>}
   {liveFrame&&<p className="text-sm font-semibold text-emerald-800">Live · Vereinslook aktiv</p>}
   {liveError&&<p role="status" className="text-sm text-slate-700">{liveError}</p>}
   <details className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><summary className="min-h-8 cursor-pointer font-semibold">So werden alle Spielerbilder einheitlich</summary><p className="mt-2">Kamera auf Augenhöhe halten und ihre Position beibehalten. Den Platz für die Spieler am Boden markieren. Bei jedem Spieler den Kopf an derselben Schablone ausrichten; große und kleine Spieler brauchen etwas mehr oder weniger Abstand. Gleichmäßiges Licht und einen ruhigen Hintergrund wählen.</p></details>
   <p className="text-sm text-slate-700">{template==='square'?'Quadratisches Spielerbild':'Spielerbild im Querformat'} · gleicher Zuschnitt beim Auslösen. {liveFrame?'Größe und Position im Vereinslook prüfen.':'Etwas Abstand halten, damit Kopf und Arme Platz haben.'}</p>
   <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-300 p-3 text-sm font-semibold">Selbstauslöser<select aria-label="Selbstauslöser" value={timerSeconds} disabled={busy} onChange={e=>setTimerSeconds(Number(e.target.value))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900">{[0,3,5,10].map(seconds=><option key={seconds} value={seconds}>{seconds?`${seconds} Sekunden`:'Aus · sofort'}</option>)}</select></label>
   <p className="text-sm text-slate-600">Gilt auch beim Auslösen über die Fernsteuerung. Countdown am Stativgerät einstellen.</p>
   <label className="flex min-h-11 items-center gap-2 text-sm"><input aria-label="Hintergrund automatisch entfernen" type="checkbox" checked={remove} disabled={busy} onChange={e=>setRemove(e.target.checked)}/>Hintergrund automatisch entfernen</label>
   </div></details>
   <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void choose(file);}}/>

   <button type="button" disabled={busy} onClick={()=>advance('skipped')} className="min-h-11 w-full rounded-xl border p-2 font-semibold">Diesen Schritt überspringen</button>

  </>:player?<>
   <ManagerProfilePhotoPreview seasonId={seasonId} layout={layout} photoUrl={draft.url} cutoutUrl={draft.cutoutUrl} firstName={player.first_name??''} lastName={player.last_name??''} number={player.jersey_number} trainer={false} clubTemplate={template} clubDesign={player.club_profile_design}/>
   <p className="rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-900">Passt alles? Kopf vollständig sichtbar, Gesicht scharf und Name gut lesbar? Sonst „Noch einmal“ wählen.</p>
   <p className="text-sm text-slate-600">{draft.cutout?'✓ Freigestellt · Vereinsgestaltung übernommen':'Originalfoto · ohne Freistellung'}</p>
   <p className="text-sm">{mode==='portrait'?'Übernehmen ersetzt das Profilfoto von':'Wird als zusätzliches '+PHOTO_LABELS[mode]+' gespeichert für'} <strong>{player.display_name}</strong>. {mode!=='portrait'?'Das Profilfoto bleibt erhalten.':''}</p>
   <button type="button" disabled={busy} onClick={()=>void save()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-50"><Check/>{saving?'Wird gespeichert…':'Übernehmen'}</button>
   <button type="button" disabled={busy} onClick={discard} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold"><RefreshCw/>Noch einmal</button>
   <label className="flex min-h-11 items-center gap-2 text-sm"><input aria-label="Zusätzlich auf Gerät speichern" type="checkbox" checked={deviceCopy} disabled={busy} onChange={e=>setDeviceCopy(e.target.checked)}/>Zusätzlich auf Gerät speichern</label>
   <p className="text-sm text-slate-600">Originalfoto · nach „Übernehmen“ am fotografierenden Gerät „Bild sichern“ wählen.</p>
   <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={autoNext} disabled={busy} onChange={e=>setAutoNext(e.target.checked)}/>Aufnahmeserie · Profil → Spieltag → Jubel → nächster Spieler</label>
  </>:null}
  {processing&&countdown===null&&<p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">Foto wird vorbereitet{remove?' und freigestellt':''}… Beim ersten Mal werden Bildwerkzeuge geladen.</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {remote.connected&&remote.error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{remote.error}</p>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </div>
 </div></div>, managerPortalRoot());
}
