import React, {useEffect, useState} from 'react';
import {CheckCircle2, Share, Smartphone, X} from 'lucide-react';
import {isStandaloneDisplayMode} from '../../lib/pwaDisplayMode';
import './marketHomeScreenGuide.css';
import {MarketInstallSlides} from './MarketInstallSlides';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
/** A saved preference is self-reported; Safari cannot inspect the Home Screen. */
export function MarketHomeScreenGuide({clubId,alwaysAvailable=false}:{clubId:string;alwaysAvailable?:boolean}){
 const [standalone,setStandalone]=useState(isStandaloneDisplayMode),[hidden,setHidden]=useState(false),[expanded,setExpanded]=useState(false),[mobile,setMobile]=useState(false),[ios,setIos]=useState(false),[prompt,setPrompt]=useState<InstallEvent|null>(null),[message,setMessage]=useState('');
 const key=`vereinsmarkt-home-guide:${clubId}`;
 useEffect(()=>{
  setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  setMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  try{setHidden(localStorage.getItem(key)==='present'||Number(localStorage.getItem(key))>Date.now());}catch{}
  const media=window.matchMedia?.('(display-mode: standalone)');
  const refresh=()=>setStandalone(isStandaloneDisplayMode());
  const offer=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
  const installed=()=>{setPrompt(null);setHidden(true);setMessage('Vereinsmarkt hinzugefügt. Öffne jetzt das neue Icon auf deinem Home-Bildschirm.');try{localStorage.setItem(key,'present');}catch{}refresh();};
  media?.addEventListener?.('change',refresh);window.addEventListener('pageshow',refresh);window.addEventListener('beforeinstallprompt',offer);window.addEventListener('appinstalled',installed);
  return()=>{media?.removeEventListener?.('change',refresh);window.removeEventListener('pageshow',refresh);window.removeEventListener('beforeinstallprompt',offer);window.removeEventListener('appinstalled',installed);};
 },[key]);
 const dismiss=(present=false)=>{setHidden(true);setExpanded(false);try{localStorage.setItem(key,present?'present':String(Date.now()+7*86400000));}catch{}};
 if(!alwaysAvailable&&(!mobile||standalone||hidden))return null;
 return <section className="market-home-guide" aria-label="Vereinsmarkt am Home-Bildschirm">
  <div className="market-home-guide-heading"><img src="/vereinsmarkt/icon-180.png" width="44" height="44" alt="Vereinsmarkt-Icon"/><div><h2>{standalone?'Über das App-Icon geöffnet':'Vereinsmarkt direkt am Handy'}</h2><p>{standalone?'Du nutzt bereits die App-Ansicht.':hidden?'Icon schon vorhanden? Öffne den Vereinsmarkt künftig darüber.':'Mit eigenem Icon öffnen – ohne App Store.'}</p></div>{!alwaysAvailable&&<button type="button" className="market-home-guide-close" aria-label="Homescreen-Hinweis schließen" onClick={()=>dismiss()}><X size={18}/></button>}</div>
  {standalone?<p className="market-home-guide-status"><CheckCircle2 size={18}/>Keine weitere Installation nötig.</p>:<>
   {message&&<p role="status">{message}</p>}
   {!expanded?<div className="market-home-guide-actions"><button type="button" onClick={()=>setExpanded(true)}><Smartphone size={18}/>So geht’s</button>{!hidden&&<button type="button" onClick={()=>dismiss(true)}>Icon bereits vorhanden</button>}</div>:<>
    <MarketInstallSlides ios={ios}/>
    <p className="market-home-guide-note">Schon ein Vereinsmarkt-Icon vorhanden? Öffne dieses. Im Browser lässt sich am iPhone nicht sicher erkennen, ob das Icon bereits hinzugefügt wurde. Stöbern geht auch hier im Browser.</p>
    {prompt&&<button type="button" className="market-home-guide-install" onClick={async()=>{try{await prompt.prompt();const choice=await prompt.userChoice;setMessage(choice.outcome==='accepted'?'Installation bestätigt. Öffne danach das Vereinsmarkt-Icon.':'Du kannst den Vereinsmarkt später hinzufügen.');}catch{setMessage('Bitte verwende die Anleitung über das Browsermenü.');}setPrompt(null);}}>Vereinsmarkt installieren</button>}
    <div className="market-home-guide-actions"><button type="button" onClick={()=>setExpanded(false)}>Anleitung schließen</button>{!alwaysAvailable&&<button type="button" onClick={()=>dismiss(true)}>Icon bereits vorhanden</button>}</div>
   </>}
  </>}
 </section>;
}
