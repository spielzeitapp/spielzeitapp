import React,{useEffect,useState} from 'react';
/** Initial launch only: children mount immediately so tournament loading overlaps the splash. */
export function LaunchSplash({children}:{children:React.ReactNode}){
 const [opening,setOpening]=useState(true);
 useEffect(()=>{const timer=window.setTimeout(()=>setOpening(false),700);return()=>window.clearTimeout(timer)},[]);
 return <>{opening?<div className="tournament-splash" role="status" aria-label="Spielzeit Turniere wird geöffnet"><img src="/turnier-app/clock-icon-512.png" alt="" width="230" height="230"/><h1>Spielzeit Turniere</h1><p>Dein Verein. Dein Turnier. Live dabei.</p><div className="tournament-splash-track" aria-hidden="true"></div><small>powered by SpielzeitApp</small></div>:null}{children}</>;
}
