import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {marketSwitchEntry} from '../club/marketSwitch';
import {useMarketManagerAccess} from './useMarketManagerAccess';
import './marketQuickSwitch.css';
/** App-header entry only. Backend grants determine which manager destinations appear. */
export function MarketQuickSwitch({userId,staff,returnTo,className}:{userId:string;staff:boolean;returnTo:string;className:string}){
 const {clubs}=useMarketManagerAccess(staff?userId:undefined);const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{setOpen(false);},[returnTo,userId]);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);root.current?.querySelector('button')?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[open]);
 if(!staff||!clubs.length)return <Link to={marketSwitchEntry(returnTo)} className={className} aria-label="Zum Vereinsmarkt wechseln" title="Vereinsmarkt"><img src="/vereinsmarkt/icon-180.png" width="36" height="36" className="h-9 w-9 rounded-full object-contain" alt=""/></Link>;
 return <div ref={root} className="market-quick-switch"><button type="button" className={className} aria-label="Vereinsmarkt-Schnellwechsel" aria-expanded={open} onClick={()=>setOpen(v=>!v)} title="Vereinsmarkt und Verwaltung"><img src="/vereinsmarkt-manager/shield-m-192.png" width="36" height="36" className="h-9 w-9 rounded-full object-contain" alt=""/></button>{open&&<nav className="market-quick-switch-menu" aria-label="Vereinsmarkt-Schnellwechsel"><Link onClick={()=>setOpen(false)} to={marketSwitchEntry(returnTo)}><img src="/vereinsmarkt/icon-180.png" alt=""/><span>Vereinsmarkt<small>Stöbern und eigene Sachen anbieten</small></span></Link>{clubs.map(club=><Link key={club.id} onClick={()=>setOpen(false)} to={`/vereinsmarkt-manager/${club.id}`}><img src="/vereinsmarkt-manager/shield-m-192.png" alt=""/><span>Vereinsmarkt-Manager<small>{club.name}</small></span></Link>)}</nav>}</div>;
}
