import React,{useEffect,useRef,useState} from 'react';
import {X,Check,Smartphone,Info,MoreHorizontal,ArrowRight} from 'lucide-react';
import {MarketInstallSlides} from './MarketInstallSlides';
export function MarketInstallDialog({ios,onClose,onPresent,showChoice=false,closeLabel}:{ios:boolean;onClose:()=>void;onPresent?:()=>void;showChoice?:boolean;closeLabel?:string}){
 const [screen,setScreen]=useState<'choice'|'slides'|'later'>(showChoice?'choice':'slides');
 const showSlides=screen==='slides';
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
 return <dialog ref={ref} className={showSlides?'market-install-dialog':'market-install-dialog market-onboarding-choice market-install-welcome'} aria-labelledby="market-install-title" onCancel={e=>{e.preventDefault();onClose();}} onClose={onClose}>
  {showSlides?<>
   <header><img src="/vereinsmarkt/icon-180.png" width="44" height="44" alt=""/><div><h2 id="market-install-title">Vereinsmarkt am Handy</h2><small>Nach links wischen · Schritt für Schritt zum Icon</small></div><button type="button" onClick={onClose} aria-label="Installationsanleitung schließen"><X/></button></header>
   <MarketInstallSlides ios={ios}/>
   <button className="market-install-done" type="button" onClick={onClose}>{closeLabel??'Zum Vereinsmarkt'}</button>
   {onPresent&&<button className="market-install-done market-onboarding-later" type="button" onClick={onPresent}>Icon bereits vorhanden</button>}
   <p className="market-install-disclaimer">Die Bilder zeigen dir die Schritte. Führe sie im Browsermenü deines Handys aus. Die Anleitung allein installiert noch kein Icon.</p>
  </>:<>
   <button className="market-install-welcome-close" type="button" onClick={onClose} aria-label="Hinweis schließen"><X size={22}/></button>
   {screen==='choice'?<>
    <img className="market-install-welcome-icon" src="/vereinsmarkt/icon-180.png" width="80" height="80" alt="Vereinsmarkt-Icon"/>
    <h2 id="market-install-title">Dein Vereinsmarkt.<br/>Direkt am Handy.</h2>
    <p>Möchtest du den Vereinsmarkt zum Home-Bildschirm hinzufügen?</p>
    <ul className="market-install-benefits"><li><Smartphone size={22}/><span>Mit einem Tippen öffnen</span><Check size={21}/></li><li><Check size={22}/><span>Ohne App Store</span><Check size={21}/></li></ul>
    <button className="market-install-done" type="button" onClick={()=>setScreen('slides')}>Ja, Anleitung zeigen <ArrowRight size={21}/></button>
    <button className="market-install-done market-onboarding-later" type="button" onClick={()=>setScreen('later')}>Später</button>
    <p className="market-install-disclaimer">Du kannst auch direkt im Browser stöbern.</p>
   </>:<>
    <div className="market-install-later-icon"><Info size={46}/></div>
    <h2 id="market-install-title">Alles klar!</h2>
    <p>Du kannst den Vereinsmarkt jederzeit zum Home-Bildschirm hinzufügen.</p>
    <div className="market-install-later-path"><MoreHorizontal size={28}/><span>Mehr → App-Icon hinzufügen</span></div>
    <button className="market-install-done" type="button" onClick={onClose}>Jetzt stöbern</button>
   </>}
  </>}
 </dialog>;
}
