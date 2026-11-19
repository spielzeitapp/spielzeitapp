import React,{useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {LockKeyhole,X} from 'lucide-react';
import {marketAuthPath} from './marketAuth';
import './marketHomeScreenGuide.css';
export function MarketAccessPrompt({loginUrl,onClose}:{loginUrl:string;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 const registerUrl=marketAuthPath('register',new URL(loginUrl,'https://market.invalid').search);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
 return <dialog ref={ref} className="market-install-dialog market-onboarding-choice market-install-welcome market-access-dialog" aria-labelledby="market-access-title" aria-describedby="market-access-description" onCancel={event=>{event.preventDefault();onClose();}} onClose={onClose}>
  <button type="button" className="market-install-welcome-close" aria-label="Hinweis schließen" onClick={onClose}><X size={22}/></button>
  <div className="market-access-symbol"><LockKeyhole size={38} aria-hidden="true"/></div>
  <h2 id="market-access-title">Dafür bitte anmelden</h2>
  <p id="market-access-description">Mit deinem Konto kannst du Artikel merken, Inserate erstellen und Nachrichten austauschen.</p>
  <p className="market-access-existing">Dein SpielzeitApp-Zugang funktioniert auch hier.</p>
  <Link className="market-install-done" data-market-auth-direct to={loginUrl}>Anmelden</Link>
  <Link className="market-install-done market-onboarding-later" data-market-auth-direct to={registerUrl}>Jetzt registrieren</Link>
  <button className="market-access-browse" type="button" onClick={onClose}>Weiter stöbern</button>
 </dialog>;
}
