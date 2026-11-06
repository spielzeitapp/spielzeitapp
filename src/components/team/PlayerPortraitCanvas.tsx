import React from 'react';
import {playerPhotoDisplayUrl,preparedPlayerPortrait} from '../../lib/playerPhotoDisplay';
import {photoBackground,type PlayerPhotoLayout} from '../../lib/playerPhotoLayout';
export function PlayerPortraitCanvas({layout,photoUrl,cutoutUrl,firstName,lastName,number,eager=true,hideDecorations=false}:{layout:PlayerPhotoLayout;photoUrl?:string|null;cutoutUrl?:string|null;firstName:string;lastName:string;number?:string|number|null;eager?:boolean;hideDecorations?:boolean}) {
 const src=layout.source==='cutout'?(cutoutUrl||preparedPlayerPortrait(photoUrl)||photoUrl):(preparedPlayerPortrait(photoUrl)||photoUrl);
 const displaySrc=playerPhotoDisplayUrl(src);
 const [loadedSrc,setLoadedSrc]=React.useState<string|null>(null);
 const loaded=loadedSrc===displaySrc;
 const [failed,setFailed]=React.useState(false);React.useEffect(()=>{setFailed(false);},[src]);
 return <div className="absolute inset-0 overflow-hidden" style={{background:photoBackground(layout.background),containerType:"inline-size"}}>
 {src&&!failed?<img src={displaySrc} alt="" loading={eager?'eager':'lazy'} fetchPriority={eager?'high':'low'} decoding="async" onLoad={()=>setLoadedSrc(displaySrc)} onError={()=>setFailed(true)} className="absolute h-full w-full object-contain" style={{opacity:loaded?1:0,objectFit:'contain',left:0,top:0,objectPosition:`${layout.x}% ${layout.y}%`,transform:`translate(${layout.x-50}%, ${layout.y-50}%) scale(${layout.zoom/100})`,transformOrigin:'center'}}/>:<p className="absolute inset-0 flex items-center justify-center text-white/60">Kein Foto</p>}
 {src&&!failed&&!loaded?<span role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Foto wird geladen…</span>:null}
 <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-black/75 to-transparent"/>
 {!hideDecorations&&<div className="absolute max-w-[90%] font-black uppercase leading-none tracking-tight text-white [text-shadow:0_2px_10px_#000]" style={{left:`${layout.nameX}%`,top:`${layout.nameY}%`,fontSize:'clamp(10px, 7.2cqw, 26px)'}}><p>{firstName}</p><p className="mt-1">{lastName}</p></div>}
 {!hideDecorations&&number!=null&&number!==''?<span className="absolute text-[44px] font-black leading-none text-white [text-shadow:0_2px_10px_#000]" style={{fontSize:`${layout.numberSize??44}px`,left:`${layout.numberX}%`,top:`${layout.numberY}%`,transform:'translateX(-50%)'}}>{number}</span>:null}
 </div>;
}
