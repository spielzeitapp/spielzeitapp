import React, { useEffect, useState } from 'react';
import { prepareLogoFile } from '../../lib/logoPreparation';
import { OPPONENT_LOGO_MAX_BYTES } from '../../lib/opponentCatalog';

export function LogoUploadPreview({ file, busy, onCancel, onConfirm }: { file: File; busy: boolean; onCancel: () => void; onConfirm: (file: File) => void }) {
 const [preview,setPreview]=useState<{original:string;processed:string;file:File;changed:boolean}|null>(null);
 const [error,setError]=useState<string|null>(null);const [remove,setRemove]=useState(true);
 useEffect(()=>{
  setPreview(null);setError(null);setRemove(true);
  let active=true;const urls:string[]=[];
  if(file.size>OPPONENT_LOGO_MAX_BYTES){setError('Logo darf maximal 2 MB groß sein.');return;}
  void prepareLogoFile(file).then(result=>{
   if(!active)return;
   const original=URL.createObjectURL(file),processed=URL.createObjectURL(result.file);urls.push(original,processed);
   setPreview({original,processed,file:result.file,changed:result.changed});
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Vorschau fehlgeschlagen.');});
  return()=>{active=false;urls.forEach(u=>URL.revokeObjectURL(u));};
 },[file]);
 return <div className="space-y-3 rounded-xl border border-red-400/25 bg-black/20 p-3">
  <p className="text-sm font-bold text-[var(--text-main)]">Logo-Vorschau</p>
  {preview?<><div className="flex gap-3"><div className="rounded-lg bg-white p-3"><img src={preview.original} alt="Original" className="h-20 w-20 object-contain" /></div><div className="rounded-lg bg-[#171717] p-3"><img src={remove?preview.processed:preview.original} alt="Vorschau auf dunklem Hintergrund" className="h-20 w-20 object-contain" /></div></div>
   <label className="flex gap-2 text-xs text-[var(--text-sub)]"><input type="checkbox" checked={remove} disabled={busy||!preview.changed} onChange={e=>setRemove(e.target.checked)} />{preview.changed?'Äußeren weißen Hintergrund entfernen':'Bereits transparent oder kein eindeutig weißer Außenrand – Original bleibt erhalten'}</label>
   <p className="text-xs text-[var(--text-sub)]">Bitte Wappen und weiße Details in der Vorschau prüfen.</p></>:null}
  {!preview&&!error?<p className="text-xs text-[var(--text-sub)]">Vorschau wird erstellt…</p>:null}
  {error?<p role="alert" className="text-xs text-red-300">{error}</p>:null}
  <div className="flex gap-2"><button type="button" disabled={busy||!preview||Boolean(error)} onClick={()=>preview&&onConfirm(remove?preview.file:file)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?'Speichert…':'Logo übernehmen'}</button><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[var(--text-main)]">Abbrechen</button></div>
 </div>;
}
