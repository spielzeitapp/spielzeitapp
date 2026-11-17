import React,{useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {MarketInstallSlides} from './MarketInstallSlides';
export function MarketInstallDialog({ios,onClose,onPresent,userId,initialStep=0,reminder=false}:{ios:boolean;onClose:()=>void;onPresent?:()=>void;userId?:string;initialStep?:number;reminder?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
 return <dialog ref={ref} className="market-install-dialog" aria-labelledby="market-install-title" onCancel={e=>{e.preventDefault();onClose();}} onClose={onClose}>
  <header><img src="/vereinsmarkt/icon-180.png" width="44" height="44" alt=""/><div><h2 id="market-install-title">Vereinsmarkt am Handy</h2><small>Nach links wischen · Icon und Benachrichtigungen einrichten</small></div><button type="button" onClick={onClose} aria-label="Installationsanleitung schließen"><X/></button></header>
  <MarketInstallSlides ios={ios} userId={userId} initialStep={initialStep}/>
  <button className="market-install-done" type="button" onClick={onClose}>{reminder?'Später erinnern':'Zum Vereinsmarkt'}</button>
  {onPresent&&<button className="market-install-done" type="button" onClick={onPresent}>Icon bereits vorhanden</button>}
  <p className="market-install-disclaimer">Die Bilder zeigen dir die Schritte. Führe sie im Browsermenü deines Handys aus. Die Anleitung allein installiert noch kein Icon.</p>
 </dialog>;
}
