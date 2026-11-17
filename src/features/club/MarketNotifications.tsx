import React,{useEffect} from 'react';
import {Bell,BellRing,BellOff} from 'lucide-react';
import {usePushSubscription} from '../../hooks/usePushSubscription';
import {syncAppBadge} from '../../lib/notifications/appBadge';
import {isStandaloneDisplayMode} from '../../lib/pwaDisplayMode';
import './marketNotifications.css';
export function MarketNotifications({userId,unread}:{userId:string;unread?:number}){
 const push=usePushSubscription(userId);
 useEffect(()=>{if(push.isActive&&typeof unread==='number')void syncAppBadge(unread);},[push.isActive,unread]);
 useEffect(()=>{const sync=()=>{if(!document.hidden)void push.syncFromBrowser();};window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);window.addEventListener('vereinsmarkt:push-changed',sync);return()=>{window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);window.removeEventListener('vereinsmarkt:push-changed',sync);};},[push.syncFromBrowser]);
 const blocked=push.permission==='denied';
 const ios=typeof navigator!=='undefined'&&(/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
 const needsIcon=ios&&!isStandaloneDisplayMode();
 const active=push.initDone&&!blocked&&push.isActive;
 const status=!push.initDone?'Status wird geprüft…':blocked?'Benachrichtigungen blockiert':active?'Benachrichtigungen aktiv':'Benachrichtigungen nicht aktiviert';
 const StatusIcon=!push.initDone?Bell:active?BellRing:BellOff;
 const statusClass=!push.initDone?'checking':active?'active':'inactive';
 return <section className="market-notifications" aria-labelledby="market-notifications-title">
 <h2 id="market-notifications-title">Benachrichtigungen</h2>
 <p>Erhalte neue Anfragen und Nachrichten auch bei geschlossener App. Ungelesene Nachrichten erscheinen als Zahl am Appsymbol.</p>
 <div role="status" className={`market-notifications-status market-notifications-status--${statusClass}`}><span className="market-notifications-status-icon"><StatusIcon size={28} aria-hidden="true"/></span><div><strong>{status}</strong><small>{!push.initDone?'Einen Moment bitte.':active?'Du erhältst Hinweise zu neuen Anfragen und Nachrichten auf diesem Gerät.':blocked?'Erlaube Mitteilungen in den Geräteeinstellungen.':'Schalte Benachrichtigungen ein, damit du neue Nachrichten mitbekommst.'}</small></div></div>
 {!push.browserOk||needsIcon?<p>Öffne den Vereinsmarkt über sein Symbol am Home-Bildschirm. Falls er noch nicht installiert ist: In Safari „Teilen“ → „Zum Home-Bildschirm“.</p>:blocked?<p>Öffne die iPhone-Einstellungen → Mitteilungen → Vereinsmarkt und erlaube Mitteilungen sowie Kennzeichen. Kehre danach hierher zurück.</p>:<>
 {!push.hasVapidKey&&push.initDone&&<p role="alert">Benachrichtigungen sind technisch noch nicht eingerichtet.</p>}
 <button className={active?'market-notifications-disable':undefined} type="button" disabled={!push.pushReady||push.loading} onClick={async()=>{const result=await(push.isActive?push.deactivate():push.activate());if(result===true||(typeof result==='object'&&result.ok))window.dispatchEvent(new Event('vereinsmarkt:push-changed'));}}>{push.loading?'Bitte warten…':push.isActive?'Benachrichtigungen ausschalten':'Benachrichtigungen aktivieren'}</button>
 </>}
 {push.actionError&&<p role="alert">{push.actionError}</p>}
 <small>Die Freigabe gilt für diesen Vereinsmarkt auf diesem Gerät. Die SpielzeitApp wird separat verwaltet.</small>
 </section>;
}
