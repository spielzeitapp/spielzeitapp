import React,{useEffect,useState} from 'react';
import {usePushSubscription} from '../../hooks/usePushSubscription';
import {isStandaloneDisplayMode} from '../../lib/pwaDisplayMode';
import {MarketInstallDialog} from './MarketInstallDialog';
const WEEK=7*24*60*60*1000;
/** Only an app reminder; the native permission request stays behind an explicit tap. */
export function MarketPushReminder({clubId,userId,enabled}:{clubId:string;userId:string;enabled:boolean}){
 const push=usePushSubscription(userId),key=`vereinsmarkt-push-later:${userId}:${clubId}`;
 const [state,setState]=useState({key:'',until:0}),[standalone,setStandalone]=useState(isStandaloneDisplayMode);
 useEffect(()=>{
  const refresh=()=>{setStandalone(isStandaloneDisplayMode());let until:number|null=null;try{const saved=Number(localStorage.getItem(key));until=Number.isFinite(saved)?saved:0;}catch{}setState(previous=>({key,until:until??(previous.key===key?previous.until:0)}));if(enabled)void push.syncFromBrowser();};
  refresh();window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);window.addEventListener('vereinsmarkt:push-changed',refresh);
  const visible=()=>{if(!document.hidden)refresh();};document.addEventListener('visibilitychange',visible);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);window.removeEventListener('vereinsmarkt:push-changed',refresh);document.removeEventListener('visibilitychange',visible);};
 },[key,enabled,push.syncFromBrowser]);
 const later=()=>{const until=Date.now()+WEEK;setState({key,until});try{localStorage.setItem(key,String(until));}catch{}};
 if(!enabled||!standalone||!push.initDone||!push.browserOk||!push.hasVapidKey||push.isActive||push.permission==='denied'||state.key!==key||state.until>Date.now())return null;
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 return <MarketInstallDialog ios={ios} userId={userId} initialStep={4} reminder onClose={later}/>;
}
