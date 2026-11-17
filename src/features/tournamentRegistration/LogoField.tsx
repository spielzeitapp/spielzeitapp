import React,{useRef,useState} from 'react';
import {ImagePlus,Shield,Trash2} from 'lucide-react';
const MAX_FILE=5*1024*1024;
export function validateLogoFile(file:{size:number;type:string}):string|null{
 if(file.size>MAX_FILE)return 'Bitte eine Datei bis 5 MB wählen.';
 return ['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type)?null:'Bitte PNG, JPG, WebP oder SVG wählen.';
}
export async function prepareRegistrationLogo(file:File):Promise<string>{
 const invalid=validateLogoFile(file);if(invalid)throw new Error(invalid);
 if(file.type==='image/svg+xml'){
  const xml=new DOMParser().parseFromString(await file.text(),'image/svg+xml');
  if(xml.querySelector('parsererror,script,foreignObject,iframe,object,embed')||xml.documentElement.localName!=='svg')throw new Error('Diese SVG-Datei kann nicht verwendet werden. Bitte als PNG speichern.');
  const externalUrl=(text:string)=>Array.from(text.matchAll(/url\(([^)]*)\)/gi)).some(m=>!m[1].trim().replace(/^['"]|['"]$/g,'').startsWith('#'));
  for(const el of Array.from(xml.querySelectorAll('*')))for(const a of Array.from(el.attributes))if(/^on/i.test(a.name)||(/href$/i.test(a.name)&&a.value&&!a.value.startsWith('#'))||externalUrl(a.value))throw new Error('Bitte ein SVG ohne externe Inhalte oder ein PNG wählen.');
  if(/<!DOCTYPE|<!ENTITY|@import/i.test(await file.text())||externalUrl(await file.text()))throw new Error('Bitte ein SVG ohne externe Inhalte oder ein PNG wählen.');
 }
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('Bild konnte nicht gelesen werden.');
  for(const size of [512,384,256]){
   const canvas=document.createElement('canvas');const ratio=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Bildverarbeitung nicht verfügbar.');ctx.drawImage(img,0,0,canvas.width,canvas.height);const png=canvas.toDataURL('image/png');if(png.length<=180000)return png;
  }
  throw new Error('Logo ist zu umfangreich. Bitte ein einfacheres PNG verwenden.');
 }finally{URL.revokeObjectURL(url)}
}
export const safeLogo=(url:string|null|undefined)=>url&&/^(data:image\/png;base64,iVBORw0KGgo|https:\/\/|\/[^/])/.test(url)?url:'';
export function LogoPreview({value}:{value?:string|null}){
 const src=safeLogo(value);return <div className="reg-logo-preview">{['light','dark'].map(t=><div key={t}><div data-tone={t}>{src?<img key={src} src={src} alt={`Vereinslogo auf ${t==='light'?'hellem':'dunklem'} Hintergrund`} onError={e=>{e.currentTarget.style.visibility='hidden'}}/>:<Shield size={30} aria-hidden/>}</div><span>{t==='light'?'Hell':'Dunkel'}</span></div>)}</div>;
}
export function LogoField({value,onChange,inheritedLogo,disabled=false,onBusyChange}:{value:string;onChange:(value:string)=>void;inheritedLogo?:string|null;disabled?:boolean;onBusyChange?:(busy:boolean)=>void}){
 const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false),[error,setError]=useState('');const preview=value==='app'?inheritedLogo:value;
 return <section className="reg-logo-field"><div><h3>Vereinslogo</h3><p className="reg-intro">Auf hellem und dunklem Hintergrund prüfen.</p></div><LogoPreview value={preview}/><input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Vereinslogo hochladen" disabled={disabled||busy} hidden onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setError('');setBusy(true);onBusyChange?.(true);try{onChange(await prepareRegistrationLogo(file))}catch(err){setError((err as Error).message)}finally{setBusy(false);onBusyChange?.(false)}}}/><div className="reg-logo-actions"><button type="button" className="reg-secondary" disabled={disabled||busy} onClick={()=>input.current?.click()}><ImagePlus size={17}/>{busy?'Logo wird vorbereitet…':preview?'Logo ersetzen':'Logo hochladen'}</button>{preview?<button type="button" className="reg-save" disabled={disabled||busy} onClick={()=>onChange('')}><Trash2 size={15}/>Entfernen</button>:null}</div>{inheritedLogo&&value!=='app'?<button type="button" className="reg-save" disabled={disabled||busy} onClick={()=>onChange('app')}>Vorhandenes App-Logo verwenden</button>:null}{value==='app'&&inheritedLogo?<p className="reg-note">Vorhandenes Vereinslogo wird übernommen.</p>:null}<p className="reg-note">PNG, JPG, WebP oder SVG · bis 5 MB. Transparenz bleibt erhalten. Das Logo wird mit deiner Meldung gespeichert.</p>{error?<p role="alert" className="reg-message reg-error">{error}</p>:null}</section>;
}
