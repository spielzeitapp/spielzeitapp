import {useCallback,useEffect,useRef,useState} from 'react';
const endpoint='/api/tournament-plan-analyze?audiencePush=';
const deviceKey='sz:audience:push-device:v1';
export function audienceDevice(create=false):string|null {
 try {const saved=localStorage.getItem(deviceKey);if(saved&&/^[-\w]{43}$/.test(saved))return saved;if(!create)return null;const bytes=crypto.getRandomValues(new Uint8Array(32));const token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');localStorage.setItem(deviceKey,token);return token}catch{return null}
}
async function request(action:string,body?:Record<string,unknown>){
 const controller=new AbortController(),timer=globalThis.setTimeout(()=>controller.abort(),20000);
 try {
  const response=await fetch(endpoint+action,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal}:{cache:'no-store',signal:controller.signal});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Push derzeit nicht erreichbar.');return data;
 }finally{globalThis.clearTimeout(timer)}
}
async function registration(){
 const reg=await navigator.serviceWorker.register('/turnier-app/sw.js',{scope:'/turnier-app/'});
 if(!reg.active)await new Promise<void>((resolve,reject)=>{const worker=reg.installing||reg.waiting;if(!worker){reject(new Error('Bitte die App erneut öffnen.'));return}const timeout=window.setTimeout(()=>reject(new Error('Bitte die App erneut öffnen.')),15000);const change=()=>{if(worker.state==='activated'){window.clearTimeout(timeout);worker.removeEventListener('statechange',change);resolve()}else if(worker.state==='redundant'){window.clearTimeout(timeout);worker.removeEventListener('statechange',change);reject(new Error('Bitte die App erneut öffnen.'))}};worker.addEventListener('statechange',change);change()});
 return reg;
}
function bytes(key:string){const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
export function useAudiencePush(eventId:string,team:string){
 const supported=typeof window!=='undefined'&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const installed=window.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
 const needsInstall=ios&&!installed;
 const [config,setConfig]=useState<{ready:boolean;publicKey:string|null}|null>(null),[active,setActive]=useState(false),[registeredTeam,setRegisteredTeam]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false);const demo=eventId==='ev-tournament';
 useEffect(()=>{let current=true;if(demo)return;void request('config').then(value=>{if(current)setConfig(value)}).catch(()=>{if(current)setConfig({ready:false,publicKey:null})});const device=audienceDevice();if(device&&supported){void request('status',{eventId,device}).then(async value=>{const reg=await navigator.serviceWorker.getRegistration('/turnier-app/');const sub=await reg?.pushManager.getSubscription();if(current){setActive(value.active&&Notification.permission==='granted'&&!!sub);setRegisteredTeam(value.team)}}).catch(()=>{});}return()=>{current=false}},[eventId,supported,demo]);
 const save=useCallback(async(target:string)=>{const device=audienceDevice(true);if(!device)throw new Error('Bitte Gerätespeicher zulassen, damit du Push später abschalten kannst.');const reg=await registration();let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(config!.publicKey!)});await request('subscribe',{eventId,team:target,device,subscription:sub.toJSON()});setRegisteredTeam(target);setActive(true);},[config,eventId]);
 const enable=async()=>{
  if(lock.current||!supported||needsInstall||!config?.ready||!config.publicKey)return;
  lock.current=true;setBusy(true);setMessage('');
  try { // The native permission request stays directly inside this user gesture.
   const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error(permission==='denied'?'Mitteilungen sind blockiert. Bitte in den Browser- oder Handy-Einstellungen erlauben.':'Du kannst Benachrichtigungen später einschalten.');await save(team);setMessage('Benachrichtigungen aktiviert.');
  }catch(e){setMessage(e instanceof Error?e.message:'Aktivieren fehlgeschlagen.')}finally{lock.current=false;setBusy(false)}
 };
 // Preserve consent while switching teams; never request permission in an effect.
 useEffect(()=>{if(!active||registeredTeam===team||busy||lock.current||!config?.ready)return;lock.current=true;setBusy(true);void save(team).then(()=>setMessage('Benachrichtigungen auf dein neues Team umgestellt.')).catch(e=>{setActive(false);setMessage(e instanceof Error?e.message:'Bitte erneut aktivieren.')}).finally(()=>{lock.current=false;setBusy(false)})},[team,active,registeredTeam,busy,config,save]);
 const action=async(kind:'unsubscribe'|'test')=>{if(lock.current)return;const device=audienceDevice();if(!device)return;lock.current=true;setBusy(true);setMessage('');try{await request(kind,{eventId,device});if(kind==='unsubscribe'){setActive(false);setMessage('Für dieses Turnier ausgeschaltet.')}else setMessage('Testnachricht an dein Gerät gesendet.')}catch(e){setMessage(e instanceof Error?e.message:'Bitte erneut versuchen.')}finally{lock.current=false;setBusy(false)}};
 return {active,busy,message,enable,disable:()=>action('unsubscribe'),test:()=>action('test'),needsInstall,supported,ready:config?.ready===true,demo,loading:!config&&!demo};
}
export type AudiencePush=ReturnType<typeof useAudiencePush>;
