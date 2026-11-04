import React,{useState,useEffect,useRef} from 'react';
import type {RosterPlayer} from '../lib/rosterService';
import {DEFAULT_PHOTO_LAYOUT,type PlayerPhotoLayout} from '../lib/playerPhotoLayout';
import {PlayerPortraitCanvas} from '../components/team/PlayerPortraitCanvas';
import {preparedPlayerPortrait} from '../lib/playerPhotoDisplay';
import {removePortraitBackground} from '../lib/removePortraitBackground';
import {uploadPlayerProfileCutout} from '../lib/profileCutoutUpload';
import {supabase} from '../lib/supabaseClient';
export function ManagerPlayerPhotoEditor({player,seasonId,onSaved,onClose,global=false}:{player:RosterPlayer;seasonId:string;global?:boolean;onSaved:()=>void;onClose:()=>void}) {
 const [layout,setLayout]=useState<PlayerPhotoLayout>(()=>({...DEFAULT_PHOTO_LAYOUT,...(global?player.photo_layout_default:player.photo_layout??player.photo_layout_default)}));
 const generation=useRef(0);
 const [pending,setPending]=useState<Blob|null>(null);
 const [previewUrl,setPreviewUrl]=useState<string|null>(null);
 const [storedCutout,setStoredCutout]=useState(player.cutout_url);
 const [generating,setGenerating]=useState(false);
 useEffect(()=>{generation.current++;setPending(null);setStoredCutout(player.cutout_url);setGenerating(false);return()=>{generation.current++;};},[player.id,player.avatar_url,player.cutout_url]);
 useEffect(()=>{if(!pending){setPreviewUrl(null);return;}const url=URL.createObjectURL(pending);setPreviewUrl(url);return()=>URL.revokeObjectURL(url);},[pending]);
 const cutout=previewUrl||storedCutout;
 const [replaceAll,setReplaceAll]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const patch=(key:keyof PlayerPhotoLayout,value:string|number)=>setLayout(old=>({...old,[key]:value}));
 const generate=async()=>{
  if(busy||generating)return;
  const version=++generation.current;setGenerating(true);setError('');
  try{const blob=await removePortraitBackground(player.avatar_url||'');if(version!==generation.current)return;setPending(blob);setLayout(old=>({...old,source:'cutout'}));}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Hintergrund konnte nicht entfernt werden. Bitte erneut versuchen.');}
  finally{if(version===generation.current)setGenerating(false);}
 };
 const save=async(reset=false)=>{
  if(busy||generating)return;setBusy(true);setError('');
  try{
   if(!reset&&pending&&layout.source==='cutout'){
    const uploaded=await uploadPlayerProfileCutout(seasonId,player.id,new File([pending],'portrait.png',{type:'image/png'}));
    if(uploaded.error||!uploaded.cutoutUrl)throw new Error(uploaded.error||'Freisteller konnte nicht gespeichert werden.');
    const {data,error:photoError}=await supabase.from('players').update({cutout_url:uploaded.cutoutUrl}).eq('id',player.id).select('id').single();
    if(photoError||!data)throw new Error(photoError?.message||'Keine Berechtigung zum Speichern des Freistellers.');
    setStoredCutout(uploaded.cutoutUrl);setPending(null);
   }
   const {error}=await supabase.rpc(global?'admin_save_global_photo_layout':'admin_save_player_photo_layout',{p_team_season_id:seasonId,...(global?{p_replace_individual:replaceAll}:{p_player_id:player.id}),p_layout:reset?null:layout,p_expected:(global?player.photo_layout_default:player.photo_layout)??null});
   if(error)throw error;onSaved();
  }catch(e){setError(e instanceof Error?e.message:(e as {message?:string}).message||'Speichern fehlgeschlagen.');}finally{setBusy(false);}
 };
 const slider=(key:keyof PlayerPhotoLayout,label:string,min=0,max=100)=><label className="block text-sm" key={key}>{label}: {layout[key]}<input aria-label={label} type="range" min={min} max={max} value={layout[key]} disabled={busy||generating} onChange={e=>patch(key,Number(e.target.value))} className="block w-full"/></label>;
 return <section className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label={`Foto gestalten: ${player.display_name}`}>
 <h3 className="font-semibold">{global?"Globale Foto-Gestaltung · gesamte Mannschaft/Saison":`Foto gestalten · ${player.display_name}`}</h3><p className="my-2 text-sm">Gilt für Teamansicht und Spielerprofil dieser Mannschaft/Saison. Das Originalfoto bleibt erhalten.</p>
 <div className="grid gap-5 md:grid-cols-2"><div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-2xl border border-yellow-600"><PlayerPortraitCanvas layout={layout} photoUrl={player.avatar_url} cutoutUrl={cutout} firstName={player.first_name||''} lastName={player.last_name||''} number={player.jersey_number}/></div>
 <fieldset disabled={busy||generating} className="space-y-3"><label className="block text-sm">Hintergrund<select className="ml-2 rounded border p-2" value={layout.background} onChange={e=>patch('background',e.target.value)}><option value="blue-left">Vereinsfarbe links · Schwarz rechts</option><option value="blue-right">Schwarz links · Vereinsfarbe rechts</option><option value="black">Schwarz</option></select></label>
 <label className="block text-sm">Bild<select className="ml-2 rounded border p-2" value={layout.source} onChange={e=>patch('source',e.target.value)}><option value="original">Originalfoto</option><option value="cutout" disabled={!cutout&&!preparedPlayerPortrait(player.avatar_url)}>Freisteller verwenden</option></select></label>
 <button type="button" disabled={busy||generating||!player.avatar_url} onClick={()=>void generate()} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50">{generating?'Hintergrund wird entfernt…':global?`Hintergrund bei ${player.first_name} entfernen`:'Hintergrund entfernen'}</button>
 <p className="text-xs text-slate-500">Einzelportrait verwenden. Die Verarbeitung erfolgt im Browser; beim ersten Mal werden Bildwerkzeuge geladen. {global?`Die Freistellung betrifft nur ${player.display_name}, nicht automatisch die gesamte Mannschaft.`:''}</p>
 {pending?<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm"><p>Vorschau: Bitte Haare und Konturen prüfen. Das Original bleibt erhalten. Erst „Freisteller & Gestaltung speichern“ übernimmt das Ergebnis.</p><button type="button" disabled={busy||generating} onClick={()=>{setPending(null);setLayout(old=>({...old,source:'original'}));}} className="mt-1 underline">Freistellung verwerfen</button></div>:null}
 {slider('zoom','Bildgröße',50,180)}{slider('x','Bild horizontal')}{slider('y','Bild vertikal')}{slider('nameX','Name horizontal',2,65)}{slider('nameY','Name vertikal',5,85)}{slider('numberX','Nummer horizontal',8,92)}{slider('numberY','Nummer vertikal',3,85)}{slider('numberSize','Nummerngröße',20,80)}
 </fieldset></div>
 {global?<label className="mt-4 block text-sm"><input type="checkbox" checked={replaceAll} disabled={busy||generating} onChange={e=>setReplaceAll(e.target.checked)}/> Individuelle Gestaltungen aller Spieler dieser Mannschaft/Saison ersetzen. Ohne Haken bleiben sie erhalten.</label>:null}
 {error?<p role="alert" className="my-3 text-red-700">{error}</p>:null}
 <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy||generating} onClick={()=>void save()} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Speichern…':pending&&layout.source==='cutout'?'Freisteller & Gestaltung speichern':'Gestaltung speichern'}</button><button type="button" disabled={busy||generating} onClick={()=>void save(true)}>Standard wiederherstellen</button><button type="button" disabled={busy||generating} onClick={onClose}>Abbrechen</button></div>
 </section>;
}
