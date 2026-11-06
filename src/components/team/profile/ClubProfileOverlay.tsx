import React,{useRef} from 'react';
import type {ClubProfileDesign,ProfileElement} from '../../../lib/clubProfileDesign';
import {AutoFitName} from './AutoFitName';
export function moveProfileElement(design:ClubProfileDesign,key:ProfileElement,x:number,y:number):ClubProfileDesign{
 const clamp=(v:number)=>Math.round(Math.max(0,Math.min(100,v))*10)/10;
 return {...design,[key]:{...design[key],x:clamp(x),y:clamp(y)}};
}
export function ClubProfileOverlay({design,first,last,number,team,season,logo,onChange}:{design:ClubProfileDesign;first:string;last:string;number:string;team?:string|null;season:string;logo?:string|null;onChange?:(design:ClubProfileDesign)=>void}){
 const root=useRef<HTMLDivElement>(null),drag=useRef<{key:ProfileElement;id:number;x:number;y:number;design:ClubProfileDesign;width:number;height:number}|null>(null);
 const labels={name:'Spielername',number:'Rückennummer',logo:'Vereinslogo',team:'Verein und Saison'};
 return <div ref={root} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" style={{containerType:'inline-size'}} data-club-profile-overlay>
 {(['name','number','team','logo'] as const).map(key=>{const d=design[key];if(!d.visible||key==='logo'&&!logo)return null;
 const transform=d.align==='center'?'translateX(-50%)':d.align==='right'?'translateX(-100%)':undefined;
 const available=d.align==='center'?2*Math.min(d.x,100-d.x):d.align==='right'?d.x:100-d.x;
 const style:React.CSSProperties={position:'absolute',left:`${d.x}%`,top:`${d.y}%`,fontSize:`${d.size}cqw`,color:d.color,opacity:d.opacity/100,textAlign:d.align,transform,maxWidth:`${Math.max(1,available)}%`,width:key==='name'||key==='team'?`${Math.max(1,available)}%`:undefined,lineHeight:1.05,...(onChange?{pointerEvents:'auto',touchAction:'none',cursor:'move',userSelect:'none'}:{})};
 const events=onChange?{
 role:'button',tabIndex:0,'aria-label':`${labels[key]} verschieben` as string,
 onPointerDown:(e:React.PointerEvent<HTMLElement>)=>{if(e.button!==0||e.isPrimary===false)return;const box=root.current?.getBoundingClientRect();if(!box?.width||!box.height)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={key,id:e.pointerId,x:e.clientX,y:e.clientY,design,width:box.width,height:box.height};},
 onPointerMove:(e:React.PointerEvent<HTMLElement>)=>{const a=drag.current;if(!a||a.id!==e.pointerId)return;e.preventDefault();onChange(moveProfileElement(a.design,key,a.design[key].x+(e.clientX-a.x)/a.width*100,a.design[key].y+(e.clientY-a.y)/a.height*100));},
 onPointerUp:()=>{drag.current=null;},onLostPointerCapture:()=>{drag.current=null;},
 onPointerCancel:()=>{if(drag.current)onChange(drag.current.design);drag.current=null;},
 onKeyDown:(e:React.KeyboardEvent<HTMLElement>)=>{const delta= e.shiftKey?5:1;const changes:Record<string,[number,number]>={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};if(!changes[e.key])return;e.preventDefault();const [x,y]=changes[e.key];onChange(moveProfileElement(design,key,d.x+x,d.y+y));}
 }:{};
 return key==='logo'?<img key={key} {...events} draggable={false} data-profile-element={key} src={logo!} alt="" style={{...style,width:`${d.size}%`,height:'auto',maxHeight:'60%',objectFit:'contain'}}/>:<div key={key} {...events} data-profile-element={key} style={style} className="font-black uppercase tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{key==='name'?<AutoFitName first={first} last={last}/>:key==='number'?number:<>{team}<span className="mt-1 block text-[0.7em]">{season.replace(team??'','').replace(/^[ ·]+/,'')}</span></>}</div>;
 })}</div>;
}
