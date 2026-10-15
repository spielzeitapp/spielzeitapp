export type AudioFile = {id:string;scope:string;name:string;file:Blob;cloudPath?:string;category?:string;company?:string};
export type AudioSetup = {id:string;playlists:Record<string,string[]>;pads:string[];padLabels?:string[];a:string;b:string;shuffle?:boolean;offlineMusicOnly?:boolean;offlineTitle?:string;offlineSections?:{title:string;text:string}[]};
export const AUDIO_PRESETS=['Teammusik','Aufwärmen','Einlauf','Vor dem Spiel','Pause','Nach dem Spiel','Cornerwerbung','Sponsoren & Firmen'];
export const AUDIO_CATEGORIES=['Musik','Pausenmusik','Einlauf','Torhymne','Cornerwerbung','Firmenwerbung','Jingle','Outro'];
export function validPlaylistName(name:unknown):name is string{return typeof name==='string'&&name.trim()===name&&name.length>0&&name.length<=80&&!['__proto__','prototype','constructor'].includes(name);}
export function defaultAudioSetup(scope:string):AudioSetup{return {id:scope,playlists:Object.fromEntries(AUDIO_PRESETS.map(name=>[name,[]])),pads:Array(6).fill(''),a:'',b:''};}
export function moveAudio(ids:string[],index:number,delta:number){const next=index+delta;if(index<0||index>=ids.length||next<0||next>=ids.length)return ids;const result=[...ids];[result[index],result[next]]=[result[next],result[index]];return result;}
export function nextAudio(ids:string[],index:number,repeat:boolean){if(!ids.length)return -1;return index+1<ids.length?index+1:repeat?0:-1;}
// Shuffle a playback copy only: never change the saved playlist order.
export function shuffleAudio(ids:string[],random:()=>number=Math.random){const copy=[...ids];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
export function validateAudioSetup(raw:unknown,scope:string):AudioSetup{
 const result=defaultAudioSetup(scope);if(!raw||typeof raw!=='object')return result;
 const value=raw as Partial<AudioSetup>;for(const [key,list] of Object.entries(value.playlists??{}).slice(0,60)){if(validPlaylistName(key)&&Array.isArray(list))result.playlists[key]=list.filter((id):id is string=>typeof id==='string'&&id.length<600).slice(0,200);}
 if(Array.isArray(value.pads))result.pads=Array.from({length:6},(_,i)=>typeof value.pads?.[i]==='string'?value.pads[i]:'');
 if(Array.isArray(value.padLabels))result.padLabels=Array.from({length:6},(_,i)=>typeof value.padLabels?.[i]==='string'?value.padLabels[i].slice(0,45):'');
 result.a=typeof value.a==='string'?value.a:'';result.b=typeof value.b==='string'?value.b:'';
 result.offlineMusicOnly=value.offlineMusicOnly===true;
 result.shuffle=value.shuffle===true;
 result.offlineTitle=typeof value.offlineTitle==='string'?value.offlineTitle.slice(0,300):undefined;
 if(Array.isArray(value.offlineSections))result.offlineSections=value.offlineSections.filter(s=>s&&typeof s.title==='string'&&typeof s.text==='string').slice(0,30).map(s=>({title:s.title.slice(0,200),text:s.text.slice(0,10000)}));return result;
}
export function openSpeakerAudioDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('spielzeit-communications-audio',2);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('files'))request.result.createObjectStore('files',{keyPath:'id'});if(!request.result.objectStoreNames.contains('setups'))request.result.createObjectStore('setups',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Bitte andere Tabs mit Spieltagsansagen schließen und erneut versuchen.'));});}
export async function speakerAudioStore<T>(storeName:'files'|'setups',action:'all'|'get'|'put'|'delete',value?:unknown):Promise<T>{
 const db=await openSpeakerAudioDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(storeName,action==='put'||action==='delete'?'readwrite':'readonly');const store=tx.objectStore(storeName);const req=action==='all'?store.getAll():action==='get'?store.get(value as IDBValidKey):action==='put'?store.put(value):store.delete(value as IDBValidKey);let result:T;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
// Quiet, original test melodies; generated locally and never uploaded automatically.
export function speakerTestWav(notes:number[],secondsPerNote=.35):Blob{
 const rate=22050,count=Math.floor(rate*notes.length*secondsPerNote),buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
 const ascii=(offset:number,text:string)=>[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
 ascii(0,'RIFF');view.setUint32(4,36+count*2,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,count*2,true);
 for(let i=0;i<count;i++){const t=i/rate,local=t%secondsPerNote,f=notes[Math.min(notes.length-1,Math.floor(t/secondsPerNote))];const envelope=Math.min(1,local/.025,(secondsPerNote-local)/.05);view.setInt16(44+i*2,Math.sin(2*Math.PI*f*t)*Math.max(0,envelope)*.12*32767,true);}return new Blob([buffer],{type:'audio/wav'});
}
export async function prepareSpeakerOffline(){
 if(!('serviceWorker' in navigator))throw new Error('Offline-Seite wird von diesem Browser nicht unterstützt.');
 const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await registration.update();const installing=registration.installing||registration.waiting;if(installing&&installing.state!=='activated')await new Promise<void>((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error('Offline-Dienst aktualisiert noch. Bitte erneut versuchen.')),15000);const changed=()=>{if(installing.state==='activated'){window.clearTimeout(timer);installing.removeEventListener('statechange',changed);resolve();}else if(installing.state==='redundant'){window.clearTimeout(timer);installing.removeEventListener('statechange',changed);reject(new Error('Offline-Dienst konnte nicht aktiviert werden.'));}};installing.addEventListener('statechange',changed);changed();});await navigator.serviceWorker.ready;const worker=registration.active;if(!worker)throw new Error('Offline-Dienst noch nicht bereit. Bitte erneut versuchen.');
 return await new Promise<void>((resolve,reject)=>{const channel=new MessageChannel();const timer=window.setTimeout(()=>{channel.port1.close();reject(new Error('Offline-Vorbereitung dauert zu lange. Bitte erneut versuchen.'));},20000);channel.port1.onmessage=event=>{window.clearTimeout(timer);channel.port1.close();event.data?.ok?resolve():reject(new Error('Offline-Seite konnte nicht gespeichert werden.'));};worker.postMessage({type:'SPZ_PREPARE_SPEAKER_OFFLINE'},[channel.port2]);});
}
