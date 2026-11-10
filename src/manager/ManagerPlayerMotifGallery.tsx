import {useUnsavedProfileGuard} from './useUnsavedProfileGuard';
import React,{useEffect,useState} from 'react';
import type {RosterPlayer} from '../lib/rosterService';
import {listPlayerPhotoMotifs,PHOTO_LABELS,type PlayerPhotoMotif,type MotifPurpose} from '../lib/playerPhotoMotifs';
import {ManagerPlayerPhotoEditor} from './ManagerPlayerPhotoEditor';
import {ManagerPlayerPhotoBooth} from './ManagerPlayerPhotoBooth';
export function ManagerPlayerMotifGallery({seasonId,player,onSaved,onDirtyChange,onBusyChange}:{seasonId:string;player:RosterPlayer;onSaved:()=>void;onDirtyChange?:(v:boolean)=>void;onBusyChange?:(v:boolean)=>void}) {
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
 useUnsavedProfileGuard(dirty,'Ungespeichertes Zusatzfoto verwerfen?',false);
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 const [motifs,setMotifs]=useState<PlayerPhotoMotif[]>([]),[error,setError]=useState(''),[editing,setEditing]=useState<MotifPurpose|null>(null),[capture,setCapture]=useState<MotifPurpose|null>(null),[version,setVersion]=useState(0);
 useEffect(()=>{let active=true;setError('');void listPlayerPhotoMotifs(seasonId).then(data=>{if(active)setMotifs(data.filter(m=>m.player_id===player.id));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[seasonId,player.id,version]);
 const done=()=>{setDirty(false);setEditing(null);setVersion(v=>v+1);onSaved();};
 const motif=motifs.find(m=>m.purpose===editing);
 return <section className="mt-4 space-y-3 rounded-xl border bg-slate-50 p-4" aria-label="Spieltag- und Jubelfotos"><h3 className="font-bold">Zusätzliche Spielerfotos</h3><p className="text-sm">Getrennt vom Profilfoto gespeichert. Freistellen, Helligkeit, Drehen und Ausschnitt lassen sich nachträglich bearbeiten.</p>
 {(['matchday','celebration','matchday_away','celebration_away'] as const).map(purpose=>{const photo=motifs.find(m=>m.purpose===purpose);return <div key={purpose} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3"><div className="flex-1"><h4 className="font-semibold">{PHOTO_LABELS[purpose]}</h4><p className="text-xs">{photo?'Gespeichert'+(photo.cutout_url?' · freigestellt':' · Originalfoto'):'Noch kein Foto'}</p></div>{photo&&<img src={photo.cutout_url??photo.original_url} alt={PHOTO_LABELS[purpose]} className="h-20 w-20 rounded-lg bg-slate-200 object-contain"/>}{photo&&<button type="button" disabled={busy} onClick={()=>{if(!dirty||window.confirm('Änderungen verwerfen?')){setDirty(false);setEditing(purpose);}}} className="min-h-11 rounded-lg border px-3 font-semibold">Foto bearbeiten</button>}<button type="button" disabled={busy||dirty} onClick={()=>setCapture(purpose)} className="min-h-11 rounded-lg border px-3">{photo?'Neu aufnehmen':'Aufnehmen / auswählen'}</button></div>;})}
 {motif&&<ManagerPlayerPhotoEditor key={motif.revision} motif={motif} seasonId={seasonId} player={{...player,avatar_url:motif.original_url,cutout_url:motif.cutout_url,photo_layout:motif.layout}} onDirtyChange={setDirty} onBusyChange={setBusy} onSaved={done} onClose={()=>{if(!dirty||window.confirm('Änderungen verwerfen?')){setDirty(false);setEditing(null);}}}/>}
 {capture&&<ManagerPlayerPhotoBooth seasonId={seasonId} players={[player]} initialPlayerId={player.id} initialStep={capture} onSaved={()=>setVersion(v=>v+1)} onClose={()=>{setCapture(null);onSaved();}}/>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;
}
