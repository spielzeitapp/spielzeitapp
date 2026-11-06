import React from 'react';
import type {ClubProfileDesign} from '../../../lib/clubProfileDesign';
export function ClubProfileOverlay({design,first,last,number,team,season,logo}:{design:ClubProfileDesign;first:string;last:string;number:string;team?:string|null;season:string;logo?:string|null}){
 return <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" style={{containerType:'inline-size'}} data-club-profile-overlay>
 {(['name','number','team','logo'] as const).map(key=>{const d=design[key];if(!d.visible||key==='logo'&&!logo)return null;
 const transform=d.align==='center'?'translateX(-50%)':d.align==='right'?'translateX(-100%)':undefined;
 const style:React.CSSProperties={position:'absolute',left:`${d.x}%`,top:`${d.y}%`,fontSize:`${d.size}cqw`,color:d.color,opacity:d.opacity/100,textAlign:d.align,transform,maxWidth:'96%',lineHeight:1.05};
 return key==='logo'?<img key={key} data-profile-element={key} src={logo!} alt="" style={{...style,width:`${d.size}%`,height:'auto',maxHeight:'60%',objectFit:'contain'}}/>:<div key={key} data-profile-element={key} style={style} className="font-black uppercase tracking-tight [overflow-wrap:anywhere]">{key==='name'?<>{first}<br/>{last}</>:key==='number'?number:<>{team}<span className="mt-1 block text-[0.7em]">{season}</span></>}</div>;
 })}</div>;
}
