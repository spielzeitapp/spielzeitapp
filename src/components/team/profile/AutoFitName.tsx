import React,{useLayoutEffect,useRef,useState} from 'react';
/** Fit the actual rendered font; never enlarge beyond the club's chosen size. */
export function AutoFitName({first,last}:{first:string;last:string}){
 const ref=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1);
 useLayoutEffect(()=>{const node=ref.current;if(!node||typeof ResizeObserver==='undefined')return;
 let active=true;
 const fit=()=>{if(!active)return;const width=node.clientWidth;if(!width)return;const css=getComputedStyle(node);const ctx=document.createElement('canvas').getContext('2d');if(!ctx)return;
 ctx.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
 const widest=Math.max(ctx.measureText(first.toLocaleUpperCase()).width,ctx.measureText(last.toLocaleUpperCase()).width);
 setScale(widest?Math.min(1,width/(widest+2)):1);};
 fit();const observer=new ResizeObserver(fit);observer.observe(node);document.fonts?.ready.then(fit);return()=>{active=false;observer.disconnect();};
 },[first,last]);
 return <div ref={ref} className="w-full min-w-0" data-auto-fit-name><div style={{fontSize:`${scale}em`,whiteSpace:'nowrap'}}>{first&&<p>{first}</p>}{last&&<p className="mt-1">{last}</p>}</div></div>;
}
