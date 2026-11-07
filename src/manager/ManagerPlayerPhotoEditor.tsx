import type {PortraitEdgeCleanup} from '../lib/portraitAlpha';
import {useDraftHistory} from './useDraftHistory';
import {defaultClubProfileDesign} from '../lib/clubProfileDesign';
import {IndividualProfileElements} from './IndividualProfileElements';
import React,{useState,useEffect,useRef} from 'react';
import type {ClubProfileDesign} from '../lib/clubProfileDesign';
import type {RosterPlayer} from '../lib/rosterService';
import {DEFAULT_PHOTO_LAYOUT,type PlayerPhotoLayout} from '../lib/playerPhotoLayout';
import {ManagerProfilePhotoPreview} from './ManagerProfilePhotoPreview';
import {preparedPlayerPortrait} from '../lib/playerPhotoDisplay';
import {removePortraitBackground} from '../lib/removePortraitBackground';
import {uploadStaffProfileCutout,uploadPlayerProfileCutout} from '../lib/profileCutoutUpload';
import {supabase} from '../lib/supabaseClient';
export function ManagerPlayerPhotoEditor({player,seasonId,onSaved,onClose,global=false,trainer=false,clubTemplate,clubDesign,imageOnly=false,onDirtyChange,unified=false,onBusyChange}:{player:RosterPlayer;seasonId:string;global?:boolean;trainer?:boolean;onSaved:()=>void;onClose:()=>void;clubTemplate?:'wide'|'square';clubDesign?:ClubProfileDesign|null;imageOnly?:boolean;onDirtyChange?:(dirty:boolean)=>void;unified?:boolean;onBusyChange?:(busy:boolean)=>void}) {
 const [baseline]=useState<PlayerPhotoLayout>(()=>({...DEFAULT_PHOTO_LAYOUT,...(global?player.photo_layout_default:player.photo_layout??player.photo_layout_default)}));
 const history=useDraftHistory(baseline);
 const layout=history.value;
 const [inherit,setInherit]=useState(false);
 const setLayout=(update:PlayerPhotoLayout|((old:PlayerPhotoLayout)=>PlayerPhotoLayout))=>{setInherit(false);history.change(update);};
 const initialLayout=useRef(baseline);
 const generation=useRef(0);
 const [pending,setPending]=useState<Blob|null>(null);
 const [previewUrl,setPreviewUrl]=useState<string|null>(null);
 const [storedCutout,setStoredCutout]=useState(player.cutout_url);
 const [generating,setGenerating]=useState(false);
 const [edgeCleanup,setEdgeCleanup]=useState<PortraitEdgeCleanup>('normal');
 useEffect(()=>{generation.current++;setPending(null);setStoredCutout(player.cutout_url);setGenerating(false);return()=>{generation.current++;};},[player.id,player.avatar_url,player.cutout_url]);
 useEffect(()=>{if(!pending){setPreviewUrl(null);return;}const url=URL.createObjectURL(pending);setPreviewUrl(url);return()=>URL.revokeObjectURL(url);},[pending]);
 const cutout=previewUrl||storedCutout;
 const [replaceAll,setReplaceAll]=useState(false);
 const dirty=inherit||replaceAll||Boolean(pending)||JSON.stringify(layout)!==JSON.stringify(initialLayout.current);
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{onBusyChange?.(busy||generating);return()=>onBusyChange?.(false);},[busy,generating,onBusyChange]);
 const patch=(key:keyof PlayerPhotoLayout,value:string|number)=>setLayout(old=>({...old,[key]:value}));
 const generate=async()=>{
  if(busy||generating)return;
  const version=++generation.current;setGenerating(true);setError('');
  try{const blob=await removePortraitBackground(player.avatar_url||'',edgeCleanup);if(version!==generation.current)return;setPending(blob);setLayout(old=>({...old,source:'cutout'}));}
  catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Hintergrund konnte nicht entfernt werden. Bitte erneut versuchen.');}
  finally{if(version===generation.current)setGenerating(false);}
 };
 const save=async(reset=false)=>{
  if(busy||generating)return;setBusy(true);setError('');
  try{
   let trainerCutout:string|null=null;
   if(!reset&&pending&&layout.source==='cutout'){
    const uploaded=await (trainer?uploadStaffProfileCutout:uploadPlayerProfileCutout)(seasonId,player.id,new File([pending],'portrait.png',{type:'image/png'}));
    if(uploaded.error||!uploaded.cutoutUrl)throw new Error(uploaded.error||'Freisteller konnte nicht gespeichert werden.');
    if(trainer){trainerCutout=uploaded.cutoutUrl;}else{
    const {data,error:photoError}=await supabase.from('players').update({cutout_url:uploaded.cutoutUrl}).eq('id',player.id).select('id').single();
    if(photoError||!data)throw new Error(photoError?.message||'Keine Berechtigung zum Speichern des Freistellers.');
    }
    if(!trainer){setStoredCutout(uploaded.cutoutUrl);setPending(null);}
   }
   const {error}=await supabase.rpc(trainer?'save_staff_photo_layout':global?'admin_save_global_photo_layout':'admin_save_player_photo_layout',{p_team_season_id:seasonId,...(trainer?{p_user_id:player.id,p_cutout_url:trainerCutout}:global?{p_replace_individual:replaceAll}:{p_player_id:player.id}),p_layout:reset||inherit?null:layout,p_expected:(global?player.photo_layout_default:player.photo_layout)??null});
   if(error)throw error;initialLayout.current=layout;history.reset(layout);setInherit(false);onDirtyChange?.(false);onSaved();
  }catch(e){setError(e instanceof Error?e.message:(e as {message?:string}).message||'Speichern fehlgeschlagen.');}finally{setBusy(false);}
 };
 const slider=(key:Exclude<keyof PlayerPhotoLayout,'profileDesign'|'background'|'source'>,label:string,min=0,max=100)=><label className="block text-sm" key={key}>{label}: {layout[key]}<input aria-label={label} type="range" min={min} max={max} value={layout[key]} disabled={busy||generating} onChange={e=>patch(key,Number(e.target.value))} className="block w-full"/></label>;
 return <section onPointerDownCapture={history.begin} onPointerUpCapture={history.end} onPointerCancelCapture={history.end} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label={`Foto gestalten: ${player.display_name}`}>
 {!unified&&<><h3 className="font-semibold">{global?"Globale Foto-Gestaltung · gesamte Mannschaft/Saison":`Foto gestalten · ${player.display_name}`}</h3><p className="my-2 text-sm">Gilt für Teamansicht und {trainer?'Trainerprofil':'Spielerprofil'} dieser Mannschaft/Saison. Das Originalfoto bleibt erhalten.</p></>}
 {imageOnly&&!unified&&<p className="mb-3 text-sm text-slate-600">{global?'Die Bildgestaltung wird als Standard für alle bestehenden und künftig zugeordneten Spieler dieser Mannschaft/Saison gespeichert. Individuelle Ausnahmen bleiben erhalten, sofern du sie unten nicht ausdrücklich ersetzt.':'Nur das Bild dieses Spielers in dieser Mannschaft/Saison wird geändert.'} Bei einem gestalteten Originalfoto bewegen sich Person, Hintergrund und enthaltene Schrift gemeinsam. Name, Nummer und Logo stellst du oben in der Vereinsvorlage ein.</p>}
 <div className="grid gap-5" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 280px),1fr))"}}><div className={`relative mx-auto w-full ${unified?'lg:order-2 lg:sticky lg:top-4 lg:self-start':'max-w-[400px]'}`}><ManagerProfilePhotoPreview onDesignChange={unified&&!busy&&!generating?value=>setLayout(old=>({...old,profileDesign:value})):undefined} clubTemplate={clubTemplate} clubDesign={unified?layout.profileDesign??clubDesign??defaultClubProfileDesign(clubTemplate??player.club_photo_template??'wide'):clubDesign} seasonId={seasonId} trainer={trainer} layout={layout} photoUrl={player.avatar_url} cutoutUrl={cutout} firstName={player.first_name||''} lastName={player.last_name||''} number={player.jersey_number}/></div>
 <fieldset disabled={busy||generating} className="min-w-0 space-y-3"><label className="block text-sm">Hintergrund<select className="mt-1 block w-full max-w-full rounded border p-2" value={layout.background} onChange={e=>patch('background',e.target.value)}><option value="blue-left">Vereinsfarbe links · Schwarz rechts</option><option value="blue-right">Schwarz links · Vereinsfarbe rechts</option><option value="black">Ohne Motiv · Schwarz</option><option value="nsg-art">NSG-Design · Rot-Schwarz</option><option value="rohrbach-silver">Rohrbach · Anthrazit/Silber</option></select></label><p className="text-xs text-slate-500">Bereits gestaltetes Vereinsfoto (z. B. Melk): „Originalfoto“ verwenden; enthaltenes Logo und Hintergrund bleiben erhalten. Für den Designhintergrund hinter der Person „Freisteller verwenden“ wählen oder zuerst „Hintergrund entfernen“.</p>
 {layout.background==='rohrbach-silver'&&<p className="text-xs text-slate-600">Rohrbach-Motiv: Das gespeicherte Vereinslogo, Name und Nummer bleiben separat einstellbar. Für den sichtbaren Designhintergrund „Freisteller verwenden“ wählen. Spieler ohne Freisteller behalten ihren Fotohintergrund. Für alle Spieler im Modus „Gesamte Mannschaft“ speichern; individuelle Ausnahmen bleiben erhalten.</p>}
 {!trainer&&!unified?<button type="button" onClick={()=>{setPending(null);setLayout({...DEFAULT_PHOTO_LAYOUT,source:'original'});}} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold">Originalfoto vollständig anzeigen</button>:null}
 <label className="block text-sm">Bild<select className="mt-1 block w-full max-w-full rounded border p-2" value={layout.source} onChange={e=>patch('source',e.target.value)}><option value="original">Originalfoto</option><option value="cutout" disabled={!cutout&&!preparedPlayerPortrait(player.avatar_url)}>Freisteller verwenden</option></select></label>
 {!unified||!global?<><label className="block text-sm">Freisteller-Kanten<select aria-label="Freisteller-Kanten" value={edgeCleanup} disabled={busy||generating} onChange={e=>setEdgeCleanup(e.target.value as PortraitEdgeCleanup)} className="mt-1 block w-full rounded border p-2"><option value="normal">Standard · weiche Kontur</option><option value="strong">Stärker bereinigen · bei hellen Rändern</option></select></label><p className="text-xs text-slate-500">Nach der Auswahl „Hintergrund entfernen“ erneut starten. Stärkeres Bereinigen kann feine Haare und Kleidungskanten verkleinern. Das Original bleibt erhalten.</p><button type="button" disabled={busy||generating||!player.avatar_url} onClick={()=>void generate()} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50">{generating?'Hintergrund wird entfernt…':global?`Hintergrund bei ${player.first_name} entfernen`:'Hintergrund entfernen'}</button></>:null}
 <p className="text-xs text-slate-500">{unified&&global?'Freisteller werden einzeln im Spielermodus erstellt. ':''}Einzelportrait verwenden. Die Verarbeitung erfolgt im Browser; beim ersten Mal werden Bildwerkzeuge geladen. {global?`Die Freistellung betrifft nur ${player.display_name}, nicht automatisch die gesamte Mannschaft.`:''}</p>
 {pending?<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm"><p>Vorschau: Bitte Haare und Konturen prüfen. Das Original bleibt erhalten. Erst „Freisteller & Gestaltung speichern“ übernimmt das Ergebnis.</p><button type="button" disabled={busy||generating} onClick={()=>{setPending(null);setLayout(old=>({...old,source:'original'}));}} className="mt-1 underline">Freistellung verwerfen</button></div>:null}
 {slider('zoom','Bildgröße',50,180)}{slider('x','Bild horizontal')}{slider('y','Bild vertikal')}{!imageOnly&&<>{slider('nameX','Name horizontal',2,65)}{slider('nameY','Name vertikal',5,85)}{slider('numberX',trainer?'TR horizontal':'Nummer horizontal',8,92)}{slider('numberY',trainer?'TR vertikal':'Nummer vertikal',3,85)}{slider('numberSize',trainer?'TR Größe':'Nummerngröße',20,80)}</>}
 {unified&&<IndividualProfileElements unified disabled={busy||generating} design={layout.profileDesign} base={clubDesign??player.club_profile_design} template={clubTemplate??player.club_photo_template??'wide'} onChange={value=>setLayout(old=>({...old,profileDesign:value}))}/>}
 </fieldset></div>
 {!unified&&!global&&!trainer&&<IndividualProfileElements disabled={busy||generating} design={layout.profileDesign} base={clubDesign??player.club_profile_design} template={clubTemplate??player.club_photo_template??'wide'} onChange={value=>setLayout(old=>{const next={...old};if(value)next.profileDesign=value;else delete next.profileDesign;return next;})}/>}
 {global&&!unified?<label className="mt-4 block text-sm"><input type="checkbox" aria-label="Individuelle Bildgestaltungen ersetzen" checked={replaceAll} disabled={busy||generating} onChange={e=>setReplaceAll(e.target.checked)}/> Individuelle Gestaltungen aller Spieler dieser Mannschaft/Saison ersetzen. Ohne Haken bleiben sie erhalten. Mit Haken werden bisherige Einzelanpassungen entfernt; alle verwenden anschließend den Mannschaftsstandard.</label>:null}
 {error?<p role="alert" className="my-3 text-red-700">{error}</p>:null}
 {unified&&dirty&&<p className="mt-3 text-sm font-semibold text-amber-800">Ungespeicherte Änderungen · nur in der Vorschau</p>}
 <div className="mt-4 flex flex-wrap gap-3">{unified&&<button type="button" disabled={busy||generating||!history.canUndo} onClick={()=>{setInherit(false);history.undo();}} className="min-h-11 rounded-lg border px-3 disabled:opacity-40">Rückgängig</button>}<button type="button" disabled={busy||generating} onClick={()=>void save()} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50">{unified?(busy?'Speichern…':global?'Für Mannschaft speichern':`Für ${player.display_name} speichern`):busy?'Speichern…':pending&&layout.source==='cutout'?'Freisteller & Gestaltung speichern':imageOnly&&global?'Für gesamte Mannschaft speichern':'Gestaltung speichern'}</button><button type="button" disabled={busy||generating} onClick={()=>{if(unified){setPending(null);setLayout({...DEFAULT_PHOTO_LAYOUT,...(global?{}:player.photo_layout_default??{})});setInherit(true);}else void save(true);}}>{unified?(global?'Auf Vereinsstandard zurücksetzen':'Mannschaftsvorlage übernehmen'):'Standard wiederherstellen'}</button><button type="button" disabled={busy||generating} onClick={onClose}>{unified?'Änderungen verwerfen':'Abbrechen'}</button></div>
 </section>;
}
