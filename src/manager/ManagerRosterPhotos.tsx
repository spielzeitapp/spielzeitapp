import { ManagerTeamPhotoLayoutEditor } from './ManagerTeamPhotoLayoutEditor';
import { DEFAULT_TEAM_PHOTO_LAYOUT } from '../lib/teamPhotoLayout';
import React,{useEffect,useState} from 'react';
import {getTeamSeasonWritableState} from '../lib/seasonTransition';
import {supabase} from '../lib/supabaseClient';
import {uploadPlayerProfilePhoto,uploadPlayerProfileCutout} from '../lib/profileCutoutUpload';
import {prepareCutoutGeneration} from '../lib/profileImagePipeline';
import {uploadStorageObject} from '../lib/storageUpload';
import {playerPhotoDisplayUrl} from '../lib/playerPhotoDisplay';

export function validManagerImageFile(file:File):string|null {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return 'Bitte JPG, PNG oder WebP auswählen.';
 if(file.size>4*1024*1024)return 'Das Bild darf maximal 4 MB groß sein.';
 return null;
}
export function managerTeamPhotoUrl(value:string):string {
 const u=new URL(value.trim());
 if(u.protocol!=='https:'||u.username||u.password)throw Error('Bitte einen öffentlichen HTTPS-Bildlink verwenden.');
 if(u.hostname==='vereine.oefb.at'&&u.pathname.startsWith('/netzwerk/imagedownload/'))return '/api/oefb/table?view=photo&url='+encodeURIComponent(u.href);
 return u.href;
}
export function ManagerRosterPhotos({seasonId,player,onSaved,sourceUrl,onDirtyChange,onBusyChange}:{seasonId:string;player?:{id:string;name:string;avatar?:string|null;rotation?:number};onSaved:()=>void;sourceUrl?:string;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}) {
 const [resolved,setResolved]=useState<string|null>(null),[ready,setReady]=useState(false),[linkStatus,setLinkStatus]=useState('');
 const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState(''),[saved,setSaved]=useState<string|null>(null);
 const [preview,setPreview]=useState<string|null>(null),[kind,setKind]=useState('photo'),[remove,setRemove]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{onDirtyChange?.(Boolean(file));return()=>onDirtyChange?.(false);},[file,onDirtyChange]);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 useEffect(()=>{if(sourceUrl&&!player){setUrl(sourceUrl);setReady(false);setResolved(null);}},[sourceUrl,seasonId,player?.id]);
 useEffect(()=>{if(!file){setPreview(null);return;}const u=URL.createObjectURL(file);setPreview(u);return()=>URL.revokeObjectURL(u);},[file]);
 useEffect(()=>{
  setResolved(null);setReady(false);setLinkStatus('');
  if(player||file||!url.trim())return;
  const controller=new AbortController();let active=true;
  const timer=setTimeout(()=>{void(async()=>{try{
   const input=managerTeamPhotoUrl(url);const u=new URL(url.trim());let photo=input;
   setLinkStatus('Vorschau wird geladen…');
   if(u.hostname==='vereine.oefb.at'&&/\/Mannschaften\//i.test(u.pathname)){
    const response=await fetch('/api/oefb/table?view=teamPhoto&url='+encodeURIComponent(u.href),{signal:controller.signal});
    const data=await response.json();if(!response.ok||!data.photoUrl)throw Error(data.error||'Kein Mannschaftsfoto gefunden.');photo=managerTeamPhotoUrl(data.photoUrl);
   }
   if(active)setResolved(photo);
  }catch(e){if(active)setLinkStatus((e as Error).message||'Bildlink konnte nicht geladen werden.');}})();},350);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[url,file,player?.id,seasonId]);
 useEffect(()=>{if(player)return;let active=true;void supabase.from('team_photos').select('photo_url').eq('team_season_id',seasonId).maybeSingle().then(({data})=>{if(active)setSaved(data?.photo_url??null);});return()=>{active=false;};},[seasonId,player?.id]);
 async function save(){
  if(busy||(!file&&(!resolved||!ready)))return;setBusy(true);setMessage('');
  try{
   const writable=await getTeamSeasonWritableState(seasonId);if('error' in writable||!writable.writable)throw Error('error' in writable?writable.error:writable.message);
   if(file){const error=validManagerImageFile(file);if(error)throw Error(error);}
   let photo:string|null=null,cutout:string|null=null,warning='';
   if(player){
    if(!file)throw Error('Bitte ein Spielerbild auswählen.');
    if(kind==='cutout'){
     if(!['image/png','image/webp'].includes(file.type))throw Error('Freisteller bitte als transparentes PNG oder WebP hochladen.');
     const result=await uploadPlayerProfileCutout(seasonId,player.id,file);if(result.error)throw Error(result.error);cutout=result.cutoutUrl;
    }else{
     const result=await uploadPlayerProfilePhoto(seasonId,player.id,file);if(result.error)throw Error(result.error);photo=result.avatarUrl;cutout=result.cutoutUrl;
     if(!photo)throw Error('Keine Bild-URL erhalten.');
     if(remove&&!cutout){const generated=await prepareCutoutGeneration({subject:'player',teamSeasonId:seasonId,entityId:player.id,avatarUrl:photo});cutout=generated.cutoutUrl;if(!cutout)warning=' Originalfoto gespeichert. Automatisches Freistellen ist derzeit nicht verfügbar. Einen fertigen Freisteller kannst du separat hochladen.';}
     const {error}=await supabase.from('player_avatars').upsert({player_id:player.id,avatar_url:photo,updated_at:new Date().toISOString()},{onConflict:'player_id'});if(error)throw error;
    }
    if(!photo&&!cutout)throw Error('Keine Bild-URL erhalten.');
    const {data,error}=await supabase.from('players').update({cutout_url:cutout}).eq('id',player.id).select('id').maybeSingle();if(error)throw error;if(!data)throw Error('Spielerfoto konnte nicht gespeichert werden.');
   }else{
    if(file){const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${seasonId}/hero-${crypto.randomUUID()}.${ext}`;const {error}=await uploadStorageObject('team-photos',path,file,{upsert:false,contentType:file.type});if(error)throw error;photo=supabase.storage.from('team-photos').getPublicUrl(path).data.publicUrl;}else{photo=resolved;}
    const {data,error}=await supabase.from('team_photos').upsert({team_season_id:seasonId,photo_url:photo,...DEFAULT_TEAM_PHOTO_LAYOUT,updated_at:new Date().toISOString()},{onConflict:'team_season_id'}).select('photo_url').maybeSingle();if(error)throw error;if(!data)throw Error('Mannschaftsfoto konnte nicht gespeichert werden.');setSaved(data.photo_url);
   }
   setMessage('Bild gespeichert.'+warning);setFile(null);setUrl('');onSaved();
  }catch(e){setMessage((e as Error).message||'Speichern fehlgeschlagen.');}finally{setBusy(false);}
 }
 const draftLink=!player&&!file&&!!url.trim();
 const image=preview||(draftLink?resolved:(!player&&saved)||playerPhotoDisplayUrl(player?.avatar));
 return <section className="w-full space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label={player?'Spielerfoto hochladen':'Mannschaftsfoto'}>
  <h3 className="font-bold text-slate-900">{player?`Eigenes Spielerfoto · ${player.name}`:'Mannschaftsfoto · diese Saison'}</h3>
  <p className="text-sm text-slate-600">{player?'Ein eigenes Foto ersetzt das ÖFB-Foto in Teamansicht und Spielerprofil.':'Wird in der Teamansicht und den Kaderbeiträgen verwendet. ÖFB-Kaderseitenlink, direkten Bildlink oder eine eigene Datei verwenden. Vor dem Speichern wird das Bild geprüft.'}</p>
  {!player&&saved&&!file&&!url.trim()?<ManagerTeamPhotoLayoutEditor key={saved} seasonId={seasonId} photoUrl={saved} onSaved={onSaved}/>:image?<img key={image} src={image} onLoad={()=>{if(draftLink){setReady(true);setLinkStatus('Vorschau geladen. Bild kann gespeichert werden.');}}} onError={()=>{if(draftLink){setReady(false);setLinkStatus('Das Bild konnte nicht geladen werden. Bitte einen direkten Bildlink oder eine Bilddatei verwenden.');}}} alt={player?.name||'Mannschaftsfoto'} style={player&&!file?{transform:`rotate(${player.rotation??0}deg)`}:undefined} className={player?"h-48 w-48 max-w-full rounded-xl object-contain":"max-h-48 max-w-full rounded-xl object-contain"}/>:null}
  <fieldset disabled={busy} className="space-y-3">
   {player?<label className="block text-sm">Bildart<select value={kind} onChange={e=>setKind(e.target.value)} className="ml-2 rounded border p-2"><option value="photo">Originalfoto ersetzen</option><option value="cutout">Freigestelltes Bild ergänzen</option></select></label>:null}
   <label className="block text-sm">Bild auswählen · JPG, PNG oder WebP · maximal 4 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{setFile(e.target.files?.[0]??null);setMessage('');}} className="mt-2 block w-full"/></label>
   {player&&kind==='photo'?<label className="flex gap-2 text-sm"><input type="checkbox" checked={remove} onChange={e=>setRemove(e.target.checked)}/>Automatisches Freistellen versuchen</label>:null}
   {!player?<><label className="block text-sm">Alternativ: ÖFB-Kaderseitenlink oder direkter Bildlink<input type="url" value={url} onChange={e=>{setUrl(e.target.value);setReady(false);setResolved(null);setMessage('');}} placeholder="https://…/mannschaft.jpg" className="mt-1 block w-full rounded border p-2"/></label><p className="text-xs text-slate-500">Für eine Freistellung ein bereits freigestelltes PNG/WebP hochladen. Das gewählte Bild ersetzt das bisherige Mannschaftsfoto.</p></>:null}
   <button type="button" disabled={busy||(!file&&(!resolved||!ready))} onClick={()=>void save()} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?'Bild wird gespeichert…':'Bild speichern'}</button>
  </fieldset>
  {draftLink&&linkStatus?<p role="status" className="text-sm text-slate-700">{linkStatus}</p>:null}
  {message?<p role="status" className="text-sm text-slate-700">{message}</p>:null}
 </section>;
}
