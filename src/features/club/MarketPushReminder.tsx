import React,{useEffect,useRef,useState} from 'react';
import {BellRing} from 'lucide-react';
import {usePushSubscription} from '../../hooks/usePushSubscription';
import {isStandaloneDisplayMode} from '../../lib/pwaDisplayMode';
import {ownsMarketBadge} from '../../lib/notifications/marketPushScope';

const WEEK=7*24*60*60*1000;
/** Only an app reminder; the native permission request stays behind an explicit tap. */
export function MarketPushReminder({clubId,userId,enabled}:{clubId:string;userId:string;enabled:boolean}){
 const push=usePushSubscription(userId,clubId),key=`vereinsmarkt-push-later:${userId}:${clubId}`;
 const [state,setState]=useState({key:'',until:0}),[standalone,setStandalone]=useState(isStandaloneDisplayMode);
 useEffect(()=>{
  if(!enabled||typeof window==='undefined')return;
  const refresh=()=>{setStandalone(isStandaloneDisplayMode());let until:number|null=null;try{const saved=Number(localStorage.getItem(key));until=Number.isFinite(saved)?saved:0;}catch{}setState(previous=>({key,until:until??(previous.key===key?previous.until:0)}));void push.syncFromBrowser();};
  refresh();window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);window.addEventListener('vereinsmarkt:push-changed',refresh);
  const visible=()=>{if(!document.hidden)refresh();};document.addEventListener('visibilitychange',visible);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);window.removeEventListener('vereinsmarkt:push-changed',refresh);document.removeEventListener('visibilitychange',visible);};
 },[key,enabled,push.syncFromBrowser]);
 const later=()=>{const until=Date.now()+WEEK;setState({key,until});try{localStorage.setItem(key,String(until));}catch{}};
 if(!enabled||!standalone||!ownsMarketBadge(clubId)||!push.initDone||!push.browserOk||!push.hasVapidKey||push.isActive||push.permission==='denied'||state.key!==key||state.until>Date.now())return null;
 return <PushChoice onLater={later} onActivate={push.activate} busy={push.loading} error={push.actionError}/>;
}

function PushChoice({onLater,onActivate,busy,error}:{onLater:()=>void;onActivate:ReturnType<typeof usePushSubscription>['activate'];busy:boolean;error:string|null}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current;
  dialog?.showModal();
  return ()=>{if(dialog?.open)dialog.close();};
 },[]);
 return <dialog ref={ref} className="market-install-dialog market-onboarding-choice" aria-labelledby="market-push-choice-title" onCancel={event=>{event.preventDefault();onLater();}}>
  <div style={{display:'grid',placeItems:'center',width:64,height:64,marginBottom:16,borderRadius:'50%',background:'#22c55e26',color:'#4ade80'}}><BellRing size={32} aria-hidden="true"/></div>
  <h2 id="market-push-choice-title">Keine Anfrage verpassen</h2>
  <p>Jemand interessiert sich für dein Inserat oder antwortet dir? Wir benachrichtigen dich direkt am Handy – auch wenn der Vereinsmarkt geschlossen ist.</p>
  <button className="market-install-done" style={{background:'#15803d',color:'#ffffff'}} type="button" disabled={busy} onClick={()=>void onActivate()}>{busy?'Wird aktiviert…':'Benachrichtigungen aktivieren'}</button>
  <button className="market-install-done market-onboarding-later" type="button" onClick={onLater}>Später</button>
  {error&&<p role="alert">{error}</p>}
 </dialog>;
}
