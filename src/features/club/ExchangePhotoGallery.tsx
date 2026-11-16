import React,{useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,ImageOff} from 'lucide-react';
import './ExchangePhotoGallery.css';
export function ExchangePhotoGallery({photos,title,actions}:{photos:string[];title:string;actions?:React.ReactNode}){
 const rail=useRef<HTMLDivElement>(null);
 const [active,setActive]=useState(0);
 const [failed,setFailed]=useState<Set<number>>(()=>new Set());
 const index=Math.min(active,Math.max(0,photos.length-1));
 const jump=(next:number)=>{const n=Math.max(0,Math.min(photos.length-1,next));setActive(n);rail.current?.scrollTo({left:n*rail.current.clientWidth,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
 if(!photos.length)return <div className="market-photo-empty"><ImageOff aria-hidden/><p>Keine Fotos vorhanden</p></div>;
 return <section className="market-photo-gallery" aria-label="Inseratsfotos" aria-roledescription="Karussell">
  <div className="market-photo-rail" ref={rail} tabIndex={0} aria-label="Fotos – nach links oder rechts wischen"
   onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();jump(index+(e.key==='ArrowRight'?1:-1));}}}
   onScroll={e=>{const el=e.currentTarget;if(el.clientWidth)setActive(Math.max(0,Math.min(photos.length-1,Math.round(el.scrollLeft/el.clientWidth))));}}>
   {photos.map((src,i)=><div className="market-photo-slide" key={i} role="group" aria-roledescription="Bild" aria-label={`${i+1} von ${photos.length}`}>
    {src&&!failed.has(i)?<img src={src} alt={`${title} – Foto ${i+1} von ${photos.length}`} loading={i===0?'eager':'lazy'} draggable={false} onError={()=>setFailed(old=>new Set([...old,i]))}/>:<div className="market-photo-empty"><ImageOff aria-hidden/><p>{src?'Foto konnte nicht geladen werden':'Foto wird geladen…'}</p></div>}
   </div>)}
  </div>
  {actions}
  <span className="market-photo-count" aria-live="polite">{index+1} / {photos.length}</span>
  {photos.length>1&&<div className="market-photo-controls">
   <button type="button" aria-label="Vorheriges Foto" disabled={index===0} onClick={()=>jump(index-1)}><ChevronLeft size={20}/></button>
   <div className="market-photo-dots">{photos.map((_,i)=><button type="button" key={i} aria-label={`Foto ${i+1} anzeigen`} aria-pressed={index===i} onClick={()=>jump(i)}><span/></button>)}</div>
   <button type="button" aria-label="Nächstes Foto" disabled={index===photos.length-1} onClick={()=>jump(index+1)}><ChevronRight size={20}/></button>
  </div>}
 </section>;
}
