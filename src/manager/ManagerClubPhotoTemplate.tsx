import {defaultClubProfileDesign,type ClubProfileDesign,type ProfileElement} from '../lib/clubProfileDesign';
import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {listRoster,type RosterPlayer} from '../lib/rosterService';
import {DEFAULT_PHOTO_LAYOUT} from '../lib/playerPhotoLayout';
import {ManagerProfilePhotoPreview} from './ManagerProfilePhotoPreview';
type Template='wide'|'square';
export function ManagerClubPhotoTemplate({clubId,seasonId}:{clubId:string;seasonId:string}){
 const [savedDesign,setSavedDesign]=useState<ClubProfileDesign|null>(null),[design,setDesign]=useState<ClubProfileDesign|null>(null);
 const [saved,setSaved]=useState<Template|null>(null),[draft,setDraft]=useState<Template>('wide');
 const [player,setPlayer]=useState<RosterPlayer|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;setSaved(null);setError('');setNotice('');
  void (async()=>{const {data,error}=await supabase.from('clubs').select('player_photo_template,player_profile_design').eq('id',clubId).single();
   if(!active)return;if(error){setError(error.message);return;}const value=(data as unknown as {player_photo_template:Template}).player_photo_template;setSaved(value);setDraft(value);const d=(data as unknown as {player_profile_design:ClubProfileDesign|null}).player_profile_design??null;setSavedDesign(d);setDesign(d);
  })();return()=>{active=false;};
 },[clubId]);
 useEffect(()=>{let active=true;setPlayer(null);if(seasonId)void listRoster(seasonId).then(r=>{if(active){setPlayer(r.data.find(p=>p.avatar_url||p.cutout_url)??r.data[0]??null);if(r.error)setError(r.error);}});return()=>{active=false;};},[seasonId]);
 const save=async()=>{if(!saved||busy)return;setBusy(true);setError('');setNotice('');
  try{const {error}=await supabase.rpc('admin_save_club_profile_design' as never,{p_club_id:clubId,p_template:draft,p_expected:saved,p_design:design,p_expected_design:savedDesign} as never);if(error)throw error;setSaved(draft);setSavedDesign(design);setNotice('Vereinsvorlage gespeichert. Gilt für alle Mannschaften dieses Vereins.');window.dispatchEvent(new Event('manager-setup-changed'));}
  catch(e){setError((e as Error).message||'Speichern fehlgeschlagen.');}finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Profilvorlage des Vereins">
 <h2 className="font-bold text-slate-900">Spielerprofile · einheitliche Vereinsvorlage</h2>
 <p className="mt-2 text-sm text-slate-600">Gilt für alle Mannschaften und Spieler dieses Vereins. Foto, Größe und Position bleiben je Spieler einstellbar. Die Vorschau zeigt dieselbe Profilkarte wie die App.</p>
 <div className="mt-4 grid items-start gap-5 lg:grid-cols-2"><div>
 <fieldset disabled={busy||!saved} className="space-y-3"><legend className="mb-2 text-sm font-semibold">Format und Grunddesign</legend>
 {([{value:'wide',label:'Breit · 4:3',description:'Freisteller mit Vereinsfarben, Logo und großer Nummer – wie bei NSG.'},{value:'square',label:'Quadratisch · 1:1',description:'Vollständiges Vereinsfoto mit Name und kleiner Nummer – wie bei Melk.'}] as const).map(t=><label key={t.value} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3"><input type="radio" name={`photo-template-${clubId}`} value={t.value} checked={draft===t.value} onChange={()=>{setDraft(t.value);setNotice('');}}/><span className="text-sm font-semibold">{t.label}<span className="mt-1 block text-xs font-normal text-slate-600">{t.description}</span></span></label>)}
 </fieldset>
 <fieldset disabled={busy||!saved} className="mt-4 space-y-3"><legend className="text-sm font-semibold">Elemente der Vereinsvorlage</legend><p className="text-xs text-slate-500">Gilt für alle Spieler. Elemente, die bereits im Foto enthalten sind, lassen sich hier nicht verändern.</p>
 {(['name','number','logo','team'] as ProfileElement[]).map(key=>{const d=(design??defaultClubProfileDesign(draft))[key];const labels={name:'Spielername',number:'Rückennummer',logo:'Vereinslogo',team:'Verein & Saison'};const patch=(field:string,value:string|number|boolean)=>{setDesign(old=>({...old??defaultClubProfileDesign(draft),[key]:{...(old??defaultClubProfileDesign(draft))[key],[field]:value}}));setNotice('');};return <details key={key} className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">{labels[key]}</summary><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={d.visible} onChange={e=>patch('visible',e.target.checked)}/>Anzeigen</label>
 {(['x','y','size','opacity'] as const).map(field=><label key={field} className="mt-3 block text-xs">{{x:'Horizontal',y:'Vertikal',size:key==='logo'?'Logogröße':'Schriftgröße',opacity:'Deckkraft'}[field]}: {d[field]}%<input aria-label={`${labels[key]} ${field}`} className="block w-full" type="range" min={field==='size'?2:0} max={field==='size'?50:100} value={d[field]} onChange={e=>patch(field,Number(e.target.value))}/></label>)}
 {key!=='logo'&&<><label className="mt-3 block text-xs">Farbe<input aria-label={`${labels[key]} Farbe`} type="color" className="ml-2 h-9" value={d.color} onChange={e=>patch('color',e.target.value)}/></label><label className="mt-3 block text-xs">Ausrichtung<select className="ml-2 rounded border p-2" value={d.align} onChange={e=>patch('align',e.target.value)}><option value="left">Links</option><option value="center">Mittig</option><option value="right">Rechts</option></select></label></>}
 </details>;})}<button type="button" className="min-h-11 text-sm underline" onClick={()=>setDesign(null)}>Standarddarstellung wiederherstellen</button></fieldset>
 <p className="mt-3 text-xs text-slate-500">Bei fertigen Vereinsfotos enthält das Original bereits den Hintergrund. Für die breite Vorlage zuerst einen Freisteller im Kader hinterlegen.</p>
 <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy||!saved||saved===draft&&JSON.stringify(savedDesign)===JSON.stringify(design)} onClick={()=>void save()} className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50">{busy?'Speichern…':'Vereinsvorlage speichern'}</button><button type="button" disabled={busy||!saved} onClick={()=>{if(saved)setDraft(saved);setDesign(savedDesign);setNotice('');}} className="min-h-11 rounded-xl border px-4">Änderung verwerfen</button></div>
 {notice&&<p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
 </div><div className="min-w-0 rounded-xl bg-neutral-950 p-3 text-white"><p className="mb-2 text-sm font-semibold">Vorschau · {player?.display_name??'Noch kein Spieler vorhanden'}</p>
 {player?<ManagerProfilePhotoPreview key={seasonId+player.id} clubTemplate={draft} clubDesign={design} seasonId={seasonId} trainer={false} layout={player.photo_layout??player.photo_layout_default??{...DEFAULT_PHOTO_LAYOUT,source:player.cutout_url?'cutout':'original'}} photoUrl={player.avatar_url} cutoutUrl={player.cutout_url} firstName={player.first_name??''} lastName={player.last_name??''} number={player.jersey_number}/>:<p className="text-sm text-white/60">Eine Mannschaft mit Kader auswählen, um die Vorschau mit einem Spieler zu sehen.</p>}
 <p className="mt-2 text-xs text-white/60">Auswahl wird erst mit „Vereinsvorlage speichern“ übernommen.</p></div></div></section>;
}
