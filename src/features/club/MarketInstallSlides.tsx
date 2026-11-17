import React,{useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUp,Check,Globe,MoreVertical,Plus,Share,SquarePlus} from 'lucide-react';
/** Illustrations explain the native steps; they do not pretend to install the app. */
export function MarketInstallSlides({ios}:{ios:boolean}){
 const [step,setStep]=useState(0);const touch=useRef<{x:number;y:number}|null>(null);
 const titles=ios?['In Safari öffnen','Auf Teilen tippen','Zum Home-Bildschirm','Dein Vereinsmarkt-Icon']:['In Chrome öffnen','Browsermenü öffnen','App hinzufügen','Dein Vereinsmarkt-Icon'];
 const copy=ios?['Öffne diese Vereinsmarkt-Seite in Safari. Aus WhatsApp oder Mail wähle zuerst „In Safari öffnen“.','Tippe in Safari auf das Teilen-Symbol. Es kann je nach Ansicht unten oder im Menü stehen.','Wische im Teilen-Menü nach oben und wähle „Zum Home-Bildschirm“. Falls angezeigt, „Als Web-App öffnen“ einschalten und „Hinzufügen“ tippen.','Fertig! Öffne den Vereinsmarkt künftig über dieses Icon auf deinem Home-Bildschirm.']:['Öffne diese Vereinsmarkt-Seite am Handy in Chrome.','Tippe in Chrome auf die drei Punkte ⋮.','Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“ und bestätige.','Fertig! Öffne den Vereinsmarkt künftig über dieses Icon auf deinem Home-Bildschirm.'];
 const move=(n:number)=>setStep(Math.max(0,Math.min(3,n)));
 return <div className="market-install-slides" role="region" aria-label="Wischbare Installationsanleitung" aria-roledescription="Karussell" onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)move(step+(dx<0?1:-1));}}>
  <p className="market-install-platform">{ios?'iPhone / iPad':'Android'} · Schritt {step+1} von 4</p>
  <div className="market-install-phone" aria-hidden="true">
   <div className="market-install-island"/><div className="market-install-phone-time">9:41 <span>● ● ▰</span></div>
   {step===3?<div className="market-install-homescreen"><div className="market-install-app"><img src="/vereinsmarkt/icon-180.png" alt=""/><strong>Vereinsmarkt</strong><span><Check size={16}/>Bereit</span></div><div className="market-install-dock"><Globe/><Share/><SquarePlus/></div></div>:<>
    <div className="market-install-url"><Globe size={14}/><span>Dein Vereinsmarkt</span>{!ios&&<MoreVertical size={18} className={step===1?'market-install-highlight':''}/>}</div>
    <div className="market-install-mini-brand"><img src="/vereinsmarkt/icon-180.png" alt=""/><strong>Vereins<span>markt</span></strong><small>Fußballsachen weitergeben.</small></div>
    {step===0?<div className="market-install-browser-symbol"><Globe size={64}/><b>{ios?'Safari':'Chrome'}</b></div>:step===1?<div className="market-install-tap"><span>Hier tippen</span><ArrowUp size={26}/>{ios?<Share size={56}/>:<MoreVertical size={56}/>}</div>:<div className="market-install-share-sheet"><div className="market-install-handle"/><div className="market-install-share-title">{ios?'Teilen':'Chrome-Menü'}</div><div className="market-install-sheet-row">Link kopieren</div><div className="market-install-sheet-row market-install-selected"><SquarePlus size={25}/><strong>{ios?'Zum Home-Bildschirm':'App installieren'}</strong></div><div className="market-install-sheet-row"><Plus size={20}/>Hinzufügen</div><ArrowUp size={26}/></div>}
    <div className="market-install-browserbar"><ArrowLeft size={20}/><Share size={24} className={ios&&step===1?'market-install-highlight':''}/><SquarePlus size={20}/></div>
   </>}
  </div>
  <div className="market-install-caption" aria-live="polite" aria-atomic="true"><h3>{titles[step]}</h3><p>{copy[step]}</p></div>
  <div className="market-install-pagination">{titles.map((title,i)=><button type="button" key={title} aria-label={`Schritt ${i+1}: ${title}`} aria-current={step===i?'step':undefined} onClick={()=>move(i)}><span/></button>)}</div>
  <div className="market-install-controls"><button type="button" aria-label="Vorheriger Schritt" disabled={step===0} onClick={()=>move(step-1)}><ArrowLeft size={20}/></button><span>Wischen oder weiter tippen</span><button type="button" aria-label="Nächster Schritt" disabled={step===3} onClick={()=>move(step+1)}><ArrowRight size={20}/></button></div>
 </div>;
}
