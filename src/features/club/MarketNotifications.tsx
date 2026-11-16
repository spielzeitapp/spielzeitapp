import React,{useEffect} from 'react';
import {Bell} from 'lucide-react';
import {usePushSubscription} from '../../hooks/usePushSubscription';
import {syncAppBadge} from '../../lib/notifications/appBadge';
import './marketNotifications.css';
export function MarketNotifications({userId,unread}:{userId:string;unread:number}){
 const push=usePushSubscription(userId);
 useEffect(()=>{if(push.isActive)void syncAppBadge(unread);},[push.isActive,unread]);
 useEffect(()=>{if(typeof window==='undefined'||typeof document==='undefined')return;const sync=()=>{if(!document.hidden)void push.syncFromBrowser();};window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);return()=>{window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);};},[push.syncFromBrowser]);
 const blocked=push.permission==='denied';
 const status=!push.initDone?'Wird geprüft…':blocked?'In iOS oder im Browser blockiert':push.isActive?'Auf diesem Gerät aktiviert':'Auf diesem Gerät nicht aktiviert';
 return <section className="market-notifications" aria-labelledby="market-notifications-title">
 <h2 id="market-notifications-title"><Bell size={22} aria-hidden="true"/>Benachrichtigungen</h2>
 <p>Erhalte neue Anfragen und Nachrichten auch bei geschlossener App. Ungelesene Nachrichten erscheinen als Zahl am Appsymbol.</p>
 <p role="status"><strong>{status}</strong></p>
 {!push.browserOk?<p>Öffne den Vereinsmarkt über sein Symbol am Home-Bildschirm. Falls er noch nicht installiert ist: In Safari „Teilen“ → „Zum Home-Bildschirm“.</p>:blocked?<p>Öffne die iPhone-Einstellungen → Mitteilungen → Vereinsmarkt und erlaube Mitteilungen sowie Kennzeichen. Kehre danach hierher zurück.</p>:<>
 {!push.hasVapidKey&&push.initDone&&<p role="alert">Benachrichtigungen sind technisch noch nicht eingerichtet.</p>}
 <button type="button" disabled={!push.pushReady||push.loading} onClick={()=>void(push.isActive?push.deactivate():push.activate())}>{push.loading?'Bitte warten…':push.isActive?'Auf diesem Gerät deaktivieren':'Benachrichtigungen aktivieren'}</button>
 </>}
 {push.actionError&&<p role="alert">{push.actionError}</p>}
 <small>Die Freigabe gilt für diesen Vereinsmarkt auf diesem Gerät. Die SpielzeitApp wird separat verwaltet.</small>
 </section>;
}
