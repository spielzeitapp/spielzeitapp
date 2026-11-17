import React, {useEffect, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {supabase} from '../../lib/supabaseClient';
import {useAuth} from '../../auth/AuthProvider';
import {marketAuthPath} from './marketAuth';
import './marketJoin.css';

export function marketInviteToken(value: string | null): string {
 return /^[0-9a-f]{64}$/.test(value || '') ? value! : '';
}

/** Invitation stays in next through registration, confirmation and navigation. */
export function MarketJoinPanel({clubId, clubName='deinem Verein', onJoined}: {clubId:string;clubName?:string;onJoined:()=>void}) {
 const {user}=useAuth();const [params,setParams]=useSearchParams();
 const token=marketInviteToken(params.get('invite'));
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const next=`/marktplatz/${clubId}?${new URLSearchParams({...Object.fromEntries(params),view:'member'})}`;
 const query=new URLSearchParams({context:'vereinsmarkt',marketClub:clubId,next}).toString();
 async function join(){
  if(busy||!accepted||!token)return;setBusy(true);setError('');
  try {
   const result=await supabase.rpc('exchange_join',{p_club_id:clubId,p_token:token,p_accepted:accepted});
   if(result.error)throw result.error;
   if(result.data!==true)throw new Error('Beitritt fehlgeschlagen. Bitte erneut versuchen.');
   setParams(old=>{const p=new URLSearchParams(old);p.delete('invite');p.set('view','member');return p;},{replace:true});
   onJoined();
  }catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'Beitritt fehlgeschlagen. Bitte erneut versuchen.');}
  finally{setBusy(false);}
 }
 return <section className="market-join" aria-label="Dem Vereinsmarkt beitreten">
  <p className="public-market-eyebrow">Alle Eltern. Ein Vereinsmarkt.</p>
  <h2>Willkommen im Vereinsmarkt {clubName==='deinem Verein'?'':clubName}</h2>
  <p>Trainingssachen anbieten, tauschen und weitergeben – auch wenn die Mannschaft oder dein Kind noch nicht in SpielzeitApp angelegt ist.</p>
  {!token?<p className="exchange-hint">Bitte öffne den Einladungslink aus deiner Elterngruppe oder frage deinen Trainer danach. Ein Konto allein gibt noch keinen Vereinszugang.</p>:!user?<>
   <Link className="public-market-cta" to={marketAuthPath('register',query)}>Neu? Jetzt registrieren</Link>
   <Link className="public-market-register" to={marketAuthPath('login',query)}>Schon ein Konto? Anmelden</Link>
   <small>Ein Konto für Vereinsmarkt und SpielzeitApp. Nach der E-Mail-Bestätigung kannst du hier beitreten.</small>
  </>:<>
   <label className="exchange-check"><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/>Ich bin erwachsen und meine Familie gehört zu diesem Verein bzw. dieser Spielgemeinschaft.</label>
   <button className="public-market-cta" disabled={!accepted||busy} onClick={()=>void join()}>{busy?'Beitritt wird gespeichert…':'Dem Vereinsmarkt beitreten'}</button>
   <small>Du erhältst Zugang zum Vereinsmarkt. Mannschaft und Kind kannst du später in SpielzeitApp zuordnen.</small>
  </>}
  {error&&<p role="alert" className="exchange-alert">{error}</p>}
 </section>;
}

export function MarketInviteAdmin({clubId,userId}:{clubId:string;userId:string}){
 const [allowed,setAllowed]=useState(false),[link,setLink]=useState(''),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>{let active=true;setAllowed(false);setLink('');setStatus('');void supabase.rpc('can_manage_club_venues',{p_club_id:clubId}).then(r=>{if(active&&!r.error)setAllowed(r.data===true);});return()=>{active=false;};},[clubId,userId]);
 async function generate(rotate=false){setBusy(true);setStatus('');try{
  const r=await supabase.rpc('exchange_invitation',{p_club_id:clubId,p_rotate:rotate});if(r.error)throw r.error;
  const data=r.data as {token:string;expires_at:string};
  if(!marketInviteToken(data.token))throw Error('Einladung konnte nicht erstellt werden.');
  setLink(`${window.location.origin}/marktplatz/${clubId}?view=member&invite=${data.token}`);setExpires(data.expires_at);
  if(rotate)setStatus('Neuer Link erstellt. Der bisherige Link ist ungültig. Bereits beigetretene Eltern behalten ihren Zugang.');
 }catch(e){setStatus(e&&typeof e==='object'&&'message' in e?String(e.message):'Einladung konnte nicht erstellt werden.');}finally{setBusy(false);}}
 if(!allowed)return null;
 return <section className="market-join"><h2>Eltern zum Vereinsmarkt einladen</h2><p>Für alle Mannschaften – ohne angelegte Kinder. Teile den Link in euren Elterngruppen.</p>
 {link?<><label>Einladungslink<input className="market-invite-link" aria-label="Einladungslink" readOnly value={link} onFocus={e=>e.target.select()}/></label><small>Gültig bis {new Date(expires).toLocaleDateString('de-AT')}.</small>
 <button className="public-market-cta" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setStatus('Link kopiert.')).catch(()=>setStatus('Bitte den Link im Feld markieren und kopieren.'))}>Link kopieren</button>
 <details><summary>Einladungslink erneuern</summary><p>Dadurch wird der bisherige Link ungültig. Bestehende Zugänge bleiben erhalten.</p><button className="public-market-register" disabled={busy} onClick={()=>void generate(true)}>Bisherigen Link ersetzen</button></details></>:<button className="public-market-cta" disabled={busy} onClick={()=>void generate()}>{busy?'Wird geladen…':'Einladungslink anzeigen'}</button>}
 {status&&<p role="status">{status}</p>}
 </section>;
}
