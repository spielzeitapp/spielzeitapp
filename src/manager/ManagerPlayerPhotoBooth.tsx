import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Camera,RefreshCw,ImagePlus,X,Check,SwitchCamera} from 'lucide-react';
import type {RosterPlayer} from '../lib/rosterService';
import {DEFAULT_PHOTO_LAYOUT} from '../lib/playerPhotoLayout';
import {photoBoothFile} from '../lib/playerPhotoBooth';
import {removePortraitBackground} from '../lib/removePortraitBackground';
import {uploadPlayerProfilePhoto,uploadPlayerProfileCutout} from '../lib/profileCutoutUpload';
import {getTeamSeasonWritableState} from '../lib/seasonTransition';
import {supabase} from '../lib/supabaseClient';
import {ManagerProfilePhotoPreview} from './ManagerProfilePhotoPreview';
import {useUnsavedProfileGuard} from './useUnsavedProfileGuard';

type Draft={file:File;url:string;cutout:Blob|null;cutoutUrl:string|null};
export function ManagerPlayerPhotoBooth({seasonId,players,initialPlayerId,onSaved,onClose}:{seasonId:string;players:RosterPlayer[];initialPlayerId?:string;onSaved:()=>void|Promise<void>;onClose:()=>void}) {
 const [selected,setSelected]=useState(players.find(p=>p.id===initialPlayerId)?.id??players[0]?.id??'');
 const [mode,setMode]=useState<'portrait'|'celebration'>('portrait'),[facing,setFacing]=useState<'environment'|'user'>('environment');
 const [draft,setDraft]=useState<Draft|null>(null),[processing,setProcessing]=useState(false),[saving,setSaving]=useState(false);
 const [cameraReady,setCameraReady]=useState(false),[cameraError,setCameraError]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [autoNext,setAutoNext]=useState(true),[restart,setRestart]=useState(0),[remove,setRemove]=useState(true);
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),dialog=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const version=useRef(0),locked=useRef(false),mounted=useRef(true),busy=processing||saving;
 const player=players.find(p=>p.id===selected),index=players.findIndex(p=>p.id===selected);
 const template=player?.club_photo_template??'wide',aspect=template==='square'?1:4/3;
 const layout={...DEFAULT_PHOTO_LAYOUT,...(player?.photo_layout??player?.photo_layout_default),rotation:0 as const,zoom:100,x:50,y:50,source:draft?.cutout?'cutout' as const:'original' as const};
 useUnsavedProfileGuard(Boolean(draft)||busy,'Das aufgenommene Foto ist noch nicht gespeichert. Fotobox verlassen?',false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;version.current++;};},[]);
 useEffect(()=>()=>{if(draft){URL.revokeObjectURL(draft.url);if(draft.cutoutUrl)URL.revokeObjectURL(draft.cutoutUrl);}},[draft]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialog.current?.focus();
  return()=>{document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 useEffect(()=>{
  setCameraReady(false);setCameraError('');if(draft)return;
  let active=true;
  const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;};
  if(!navigator.mediaDevices?.getUserMedia){setCameraError('Livekamera nicht verfügbar. Nutze „Kamera / Bild auswählen“.');return;}
  void navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1920}},audio:false}).then(async media=>{
   if(!active||document.hidden){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;if(video.current){video.current.srcObject=media;await video.current.play();}
  }).catch(()=>{if(active)setCameraError('Kamera konnte nicht geöffnet werden. Bitte Kamerazugriff erlauben oder „Kamera / Bild auswählen“ nutzen.');});
  const visibility=()=>{if(document.hidden){stop();setCameraReady(false);setCameraError('Kamera pausiert. Zum Fortsetzen „Kamera neu starten“ wählen.');}};
  document.addEventListener('visibilitychange',visibility);
  return()=>{active=false;stop();document.removeEventListener('visibilitychange',visibility);};
 },[draft,facing,restart]);
 const close=()=>{if(saving)return;if((draft||processing)&&!window.confirm('Aufgenommenes Foto verwerfen?'))return;onClose();};
 const discard=()=>{version.current++;setDraft(null);setError('');setNotice('');};
 async function prepare(file:File){
  const token=++version.current;setError('');setNotice('');let cutout:Blob|null=null,cutoutUrl:string|null=null;
  const url=URL.createObjectURL(file);
  try{if(remove){try{cutout=await removePortraitBackground(url,'gentle');cutoutUrl=URL.createObjectURL(cutout);}catch{if(token===version.current)setNotice('Freistellung nicht möglich. Du kannst das Original übernehmen oder noch einmal fotografieren.');}}
   if(!mounted.current||token!==version.current){URL.revokeObjectURL(url);if(cutoutUrl)URL.revokeObjectURL(cutoutUrl);return;}
   setDraft({file,url,cutout,cutoutUrl});
  }catch(e){URL.revokeObjectURL(url);throw e;}
 }
 async function capture(){
  if(locked.current||!video.current||!cameraReady)return;locked.current=true;setProcessing(true);setError('');
  try{const v=video.current;const file=await photoBoothFile(v,v.videoWidth,v.videoHeight,aspect,facing==='user');if(mounted.current)await prepare(file);}
  catch(e){setError(e instanceof Error?e.message:'Aufnahme fehlgeschlagen.');}finally{locked.current=false;setProcessing(false);}
 }
 async function choose(file?:File){
  if(!file||locked.current)return;locked.current=true;setProcessing(true);setError('');
  let url='';
  try{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Bitte JPG, PNG oder WebP bis 20 MB auswählen.');
   url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
   const normalized=await photoBoothFile(image,image.naturalWidth,image.naturalHeight,aspect);if(mounted.current)await prepare(normalized);
  }catch(e){setError(e instanceof Error?e.message:'Foto konnte nicht geöffnet werden.');}finally{if(url)URL.revokeObjectURL(url);locked.current=false;setProcessing(false);}
 }
 async function save(){
  if(!player||!draft||locked.current)return;locked.current=true;setSaving(true);setError('');
  try{
   const writable=await getTeamSeasonWritableState(seasonId);if('error' in writable||!writable.writable)throw Error('error' in writable?writable.error:writable.message);
   const original=await uploadPlayerProfilePhoto(seasonId,player.id,draft.file);if(original.error||!original.avatarUrl)throw Error(original.error||'Foto konnte nicht gespeichert werden.');
   let cutoutUrl:string|null=null;
   if(draft.cutout){const uploaded=await uploadPlayerProfileCutout(seasonId,player.id,new File([draft.cutout],'freisteller.png',{type:'image/png'}));if(uploaded.error||!uploaded.cutoutUrl)throw Error(uploaded.error||'Freisteller konnte nicht gespeichert werden.');cutoutUrl=uploaded.cutoutUrl;}
   const avatar=await supabase.from('player_avatars').upsert({player_id:player.id,avatar_url:original.avatarUrl,updated_at:new Date().toISOString()},{onConflict:'player_id'});if(avatar.error)throw avatar.error;
   const updated=await supabase.from('players').update({cutout_url:cutoutUrl}).eq('id',player.id).select('id').single();if(updated.error||!updated.data)throw Error(updated.error?.message||'Keine Berechtigung zum Speichern.');
   const result=await supabase.rpc('admin_save_player_photo_layout',{p_team_season_id:seasonId,p_player_id:player.id,p_layout:layout,p_expected:player.photo_layout??null});if(result.error)throw result.error;
   await onSaved();setDraft(null);window.dispatchEvent(new Event('manager-setup-changed'));
   setNotice(`Foto für ${player.display_name} gespeichert.`);
   if(autoNext&&index<players.length-1)setSelected(players[index+1].id);
  }catch(e){setError((e as {message?:string}).message||'Speichern fehlgeschlagen. Bitte erneut versuchen.');}finally{locked.current=false;setSaving(false);}
 }
 return createPortal(<div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/80 p-0 sm:p-4" onKeyDown={e=>{
  if(e.key==='Escape'){e.stopPropagation();close();}
  if(e.key==='Tab'){const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }}><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fotobox-title" aria-busy={busy} className="mx-auto min-h-full w-full max-w-lg bg-white text-slate-900 sm:min-h-0 sm:overflow-hidden sm:rounded-2xl" style={{paddingBottom:'max(16px, env(safe-area-inset-bottom))'}}>
  <header className="flex items-center justify-between bg-[#292c31] p-4 text-white"><div><h2 id="fotobox-title" className="text-xl font-bold">{draft?'Foto prüfen':'Spieler-Fotobox'}</h2><p className="text-xs text-slate-300">{draft?'Vorschau im Vereinslook':'Aufnehmen · prüfen · übernehmen'}</p></div><button type="button" aria-label="Fotobox schließen" disabled={saving} onClick={close} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25"><X/></button></header>
  <div className="space-y-4 p-4"><label className="block text-sm font-semibold">Spieler · {index+1} von {players.length}<select aria-label="Spieler auswählen" value={selected} disabled={busy||Boolean(draft)} onChange={e=>{setSelected(e.target.value);setNotice('');}} className="mt-1 min-h-11 w-full rounded-xl border p-2">{players.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.jersey_number??'–'}</option>)}</select></label>
  {!draft?<>
   <div className="flex rounded-xl bg-slate-100 p-1">{(['portrait','celebration'] as const).map(value=><button type="button" key={value} aria-pressed={mode===value} disabled={busy} onClick={()=>setMode(value)} className={`min-h-11 flex-1 rounded-lg font-semibold ${mode===value?'bg-red-700 text-white':''}`}>{value==='portrait'?'Porträt':'Torjubel'}</button>)}</div>
   <div className="relative overflow-hidden rounded-2xl bg-slate-900" style={{aspectRatio:aspect}}>
    <video ref={video} autoPlay playsInline muted onLoadedData={()=>setCameraReady(true)} aria-label="Livekamera" className="absolute inset-0 h-full w-full object-cover" style={{transform:facing==='user'?'scaleX(-1)':undefined}}/>
    <svg aria-hidden="true" viewBox="0 0 400 500" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full"><rect x="20" y="25" width="360" height="450" rx="12" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 6"/>{mode==='portrait'?<path d="M155 115 a45 55 0 1 0 90 0 a45 55 0 1 0 -90 0 M155 170 L145 195 Q70 205 65 300 L55 460 M245 170 L255 195 Q330 205 335 300 L345 460" fill="none" stroke="white" strokeWidth="2"/>:<path d="M170 140 a30 38 0 1 0 60 0 a30 38 0 1 0 -60 0 M170 178 L145 200 L85 110 L65 55 M230 178 L255 200 L315 110 L335 55 M145 200 L140 365 L260 365 L255 200" fill="none" stroke="white" strokeWidth="2"/>}</svg>
    <p className="absolute left-3 right-3 top-3 rounded-lg bg-black/60 p-2 text-center text-sm text-white">{mode==='portrait'?'Kopf und Schultern im Rahmen':'Arme und Hände im Rahmen lassen'}</p>
    {cameraError&&<p role="status" className="absolute inset-x-4 bottom-4 rounded-xl bg-white p-3 text-sm">{cameraError}</p>}
   </div>
   <div className="flex items-center justify-between gap-3"><button type="button" aria-label="Kamera / Bild auswählen" disabled={busy} onClick={()=>fileInput.current?.click()} className="flex min-h-11 flex-col items-center gap-1 p-2 text-xs"><ImagePlus/>Kamera / Bild</button><button type="button" aria-label="Foto aufnehmen" disabled={busy||!cameraReady} onClick={()=>void capture()} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-200 bg-red-700 text-white disabled:opacity-40"><Camera size={30}/></button><button type="button" aria-label="Kamera wechseln" disabled={busy} onClick={()=>setFacing(f=>f==='user'?'environment':'user')} className="flex min-h-11 flex-col items-center gap-1 p-2 text-xs"><SwitchCamera/>Wechseln</button></div>
   <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void choose(file);}}/>
   {cameraError&&<button type="button" disabled={busy} onClick={()=>setRestart(n=>n+1)} className="min-h-11 w-full rounded-xl border font-semibold">Kamera neu starten</button>}
   <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={remove} disabled={busy} onChange={e=>setRemove(e.target.checked)}/>Hintergrund automatisch entfernen</label>
  </>:player?<>
   <ManagerProfilePhotoPreview seasonId={seasonId} layout={layout} photoUrl={draft.url} cutoutUrl={draft.cutoutUrl} firstName={player.first_name??''} lastName={player.last_name??''} number={player.jersey_number} trainer={false} clubTemplate={template} clubDesign={player.club_profile_design}/>
   <p className="text-sm text-slate-600">{draft.cutout?'✓ Freigestellt · Vereinsgestaltung übernommen':'Originalfoto · ohne Freistellung'}</p>
   <p className="text-sm">Übernehmen ersetzt das Profilfoto von <strong>{player.display_name}</strong> in Kader und Spielerprofil. Das gilt auch für die Torjubel-Aufnahme.</p>
   <button type="button" disabled={busy} onClick={()=>void save()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-50"><Check/>{saving?'Wird gespeichert…':'Übernehmen'}</button>
   <button type="button" disabled={busy} onClick={discard} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold"><RefreshCw/>Noch einmal</button>
   <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={autoNext} disabled={busy} onChange={e=>setAutoNext(e.target.checked)}/>Danach nächster Spieler</label>
  </>:null}
  {processing&&<p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">Foto wird vorbereitet{remove?' und freigestellt':''}… Beim ersten Mal werden Bildwerkzeuge geladen.</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </div>
 </div></div>,document.body);
}
