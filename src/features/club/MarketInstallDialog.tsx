import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {MarketInstallSlides} from './MarketInstallSlides';
export function MarketInstallDialog({ios,onClose,onPresent,userId,initialStep=0,reminder=false,closeLabel,showChoice=false}:{ios:boolean;onClose:()=>void;onPresent?:()=>void;userId?:string;initialStep?:number;reminder?:boolean;closeLabel?:string;showChoice?:boolean}){
 const [showSlides,setShowSlides]=useState(!showChoice);
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
 return <dialog ref={ref} className={showSlides?'market-install-dialog':'market-install-dialog market-onboarding-choice'} aria-labelledby="market-install-title" onCancel={e=>{e.preventDefault();onClose();}} onClose={onClose}>
  <header><img src="/vereinsmarkt/icon-180.png" width="44" height="44" alt=""/><div><h2 id="market-install-title">Vereinsmarkt am Handy</h2>{showSlides&&<small>Nach links wischen · Icon und Benachrichtigungen einrichten</small>}</div><button type="button" onClick={onClose} aria-label="Installationsanleitung schließen"><X/></button></header>
  {showSlides?<MarketInstallSlides ios={ios} userId={userId} initialStep={initialStep}/>:<>
   <p>Öffne den Vereinsmarkt künftig direkt über das Icon am Home-Bildschirm.</p>
   <button className="market-install-done" type="button" onClick={()=>setShowSlides(true)}>Zum Home-Bildschirm hinzufügen</button>
  </>}
  <button className={showChoice?'market-install-done market-onboarding-later':'market-install-done'} type="button" onClick={onClose}>{closeLabel??(showChoice?'Jetzt stöbern':reminder?'Später erinnern':'Zum Vereinsmarkt')}</button>
  {onPresent&&showSlides&&<button className="market-install-done" type="button" onClick={onPresent}>Icon bereits vorhanden</button>}
  <p className="market-install-disclaimer">Die Bilder zeigen dir die Schritte. Führe sie im Browsermenü deines Handys aus. Die Anleitung allein installiert noch kein Icon.</p>
 </dialog>;
}
