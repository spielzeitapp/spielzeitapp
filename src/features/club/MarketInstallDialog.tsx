import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {MarketInstallSlides} from './MarketInstallSlides';
export function MarketInstallDialog({ios,onClose,onPresent,showChoice=false}:{ios:boolean;onClose:()=>void;onPresent?:()=>void;showChoice?:boolean}){
 const [showSlides,setShowSlides]=useState(!showChoice);
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
 return <dialog ref={ref} className={showSlides?'market-install-dialog':'market-install-dialog market-onboarding-choice'} aria-labelledby="market-install-title" onCancel={e=>{e.preventDefault();onClose();}} onClose={onClose}>
  <header><img src="/vereinsmarkt/icon-180.png" width="44" height="44" alt=""/><div><h2 id="market-install-title">Vereinsmarkt am Handy</h2>{showSlides&&<small>Nach links wischen · Schritt für Schritt zum Icon</small>}</div><button type="button" onClick={onClose} aria-label="Installationsanleitung schließen"><X/></button></header>
  {showSlides?<MarketInstallSlides ios={ios}/>:<>
   <p>Öffne den Vereinsmarkt künftig direkt über das Icon am Home-Bildschirm.</p>
   <button className="market-install-done" type="button" onClick={()=>setShowSlides(true)}>Zum Home-Bildschirm hinzufügen</button>
  </>}
  <button className={showChoice?'market-install-done market-onboarding-later':'market-install-done'} type="button" onClick={onClose}>{showChoice?'Jetzt stöbern':'Zum Vereinsmarkt'}</button>
  {onPresent&&showSlides&&<button className="market-install-done" type="button" onClick={onPresent}>Icon bereits vorhanden</button>}
  {showSlides&&<p className="market-install-disclaimer">Führe die gezeigten Schritte im Browsermenü deines Handys aus.</p>}
 </dialog>;
}
