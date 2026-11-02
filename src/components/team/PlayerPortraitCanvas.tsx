import React from 'react';
import {playerPhotoDisplayUrl,preparedPlayerPortrait} from '../../lib/playerPhotoDisplay';
import {photoBackground,type PlayerPhotoLayout} from '../../lib/playerPhotoLayout';
export function PlayerPortraitCanvas({layout,photoUrl,cutoutUrl,firstName,lastName,number}:{layout:PlayerPhotoLayout;photoUrl?:string|null;cutoutUrl?:string|null;firstName:string;lastName:string;number?:string|number|null}) {
 const src=layout.source==='cutout'?(cutoutUrl||preparedPlayerPortrait(photoUrl)||photoUrl):photoUrl;
 const [failed,setFailed]=React.useState(false);React.useEffect(()=>setFailed(false),[src]);
 return <div className="absolute inset-0 overflow-hidden" style={{background:photoBackground(layout.background)}}>
 {src&&!failed?<img src={playerPhotoDisplayUrl(src)} alt="" onError={()=>setFailed(true)} className="absolute h-full w-full object-contain" style={{left:0,top:0,objectPosition:`${layout.x}% ${layout.y}%`,transform:`translate(${layout.x-50}%, ${layout.y-50}%) scale(${layout.zoom/100})`,transformOrigin:'center'}}/>:<p className="absolute inset-0 flex items-center justify-center text-white/60">Kein Foto</p>}
 <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-black/75 to-transparent"/>
 <div className="absolute max-w-[90%] font-black uppercase leading-none tracking-tight text-white [text-shadow:0_2px_10px_#000]" style={{left:`${layout.nameX}%`,top:`${layout.nameY}%`,fontSize:'clamp(16px, 4vw, 26px)'}}><p>{firstName}</p><p className="mt-1">{lastName}</p></div>
 {number!=null&&number!==''?<span className="absolute text-[44px] font-black leading-none text-white [text-shadow:0_2px_10px_#000]" style={{left:`${layout.numberX}%`,top:`${layout.numberY}%`,transform:'translateX(-50%)'}}>{number}</span>:null}
 </div>;
}
