import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Mic, Upload, Trash2 } from 'lucide-react';
import { deckGains } from '../../lib/clubCommunicationsModel';
type Track = {id:string;name:string;file:Blob;url:string};
const PAD_NAMES=['Torhymne','Einlauf','Sponsoren','Pause','Fan-Jingle','Outro'];
function openAudioDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{const req=indexedDB.open('spielzeit-communications-audio',1);req.onupgradeneeded=()=>req.result.createObjectStore('files',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
async function audioStore(action:'get'|'put'|'delete',value?:unknown):Promise<unknown>{
 const db=await openAudioDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('files',action==='get'?'readonly':'readwrite');const store=tx.objectStore('files');const req=action==='get'?store.getAll():action==='put'?store.put(value):store.delete(value as IDBValidKey);let result:unknown;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
const clock=(s:number)=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
export function DjAudioPanel({scope}:{scope:string}){
 const [tracks,setTracks]=useState<Track[]>([]),[a,setA]=useState(''),[b,setB]=useState(''),[pads,setPads]=useState<string[]>(Array(6).fill('')),[padActive,setPadActive]=useState<number|null>(null);
 const [cross,setCross]=useState(0),[volA,setVolA]=useState(.8),[volB,setVolB]=useState(.8),[speaking,setSpeaking]=useState(false),[message,setMessage]=useState('');
 const [playing,setPlaying]=useState([false,false]),[times,setTimes]=useState([[0,0],[0,0]]);
 const ar=useRef<HTMLAudioElement>(null),br=useRef<HTMLAudioElement>(null),jr=useRef<HTMLAudioElement>(null);
 const ctx=useRef<AudioContext|null>(null),gains=useRef<GainNode[]>([]),urls=useRef<string[]>([]),alive=useRef(true),generation=useRef(0);
 const refs=[ar,br,jr];const levels=deckGains(cross,volA,volB,speaking);
 function stop(){generation.current++;refs.forEach(r=>{r.current?.pause();if(r.current)r.current.currentTime=0;});setPlaying([false,false]);setPadActive(null);}
 useEffect(()=>{alive.current=true;void audioStore('get').then(rows=>{if(!alive.current)return;const list=(rows as {id:string;scope:string;name:string;file:Blob}[]).filter(t=>t.scope===scope).map(t=>{const url=URL.createObjectURL(t.file);urls.current.push(url);return {...t,url};});setTracks(list);}).catch(()=>setMessage('Lokale Audiobibliothek ist nicht verfügbar.'));
 return()=>{alive.current=false;generation.current++;refs.forEach(r=>r.current?.pause());urls.current.forEach(u=>URL.revokeObjectURL(u));void ctx.current?.close();};},[scope]);
 useEffect(()=>{if(!gains.current.length)return;const values=[levels.a,levels.b,speaking?.2:.8];values.forEach((value,i)=>{const gain=gains.current[i]?.gain;if(gain&&ctx.current){gain.cancelScheduledValues(ctx.current.currentTime);gain.setTargetAtTime(value,ctx.current.currentTime,.06);}});},[cross,volA,volB,speaking]);
 async function prepare(){
 if(!ctx.current){const Ctor=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Ctor)throw new Error('Audiosteuerung wird von diesem Browser nicht unterstützt.');
 const context=new Ctor();ctx.current=context;const limiter=context.createDynamicsCompressor();limiter.threshold.value=-6;limiter.knee.value=6;limiter.ratio.value=4;limiter.connect(context.destination);
 gains.current=refs.map((r,i)=>{if(!r.current)throw new Error('Player nicht bereit.');const source=context.createMediaElementSource(r.current);const gain=context.createGain();gain.gain.value=[levels.a,levels.b,speaking?.2:.8][i];source.connect(gain);gain.connect(limiter);return gain;});}
 await ctx.current.resume();
 }
 async function toggle(i:number){
 const el=refs[i].current;if(!el?.src){setMessage('Bitte zuerst eine Audiodatei laden.');return;}
 if(!el.paused){el.pause();return;}
 const token=generation.current;
 try{await prepare();if(token!==generation.current)return;await el.play();if(token!==generation.current){el.pause();el.currentTime=0;}setMessage('');}catch{if(i===2)setPadActive(null);setMessage('Wiedergabe nicht möglich. Bitte Dateiformat, Lautsprecher und Browser prüfen.');}
 }
 async function upload(files:FileList|null){
 if(!files)return;
 for(const file of Array.from(files)){
 if(!(file.type.startsWith('audio/')||/\.(mp3|wav|m4a|ogg|aac)$/i.test(file.name))||file.size>25*1024*1024){setMessage('Audiodateien bitte bis 25 MB pro Datei.');continue;}
 const id=scope+':'+crypto.randomUUID();try{await audioStore('put',{id,scope,name:file.name,file});if(!alive.current)return;const url=URL.createObjectURL(file);urls.current.push(url);setTracks(t=>[...t,{id,name:file.name,file,url}]);}catch{setMessage('Datei konnte nicht auf diesem Gerät gespeichert werden.');}
 }
 }
 async function remove(track:Track){try{if(a===track.id||b===track.id||pads.includes(track.id)){stop();if(a===track.id)setA('');if(b===track.id)setB('');setPads(p=>p.map(id=>id===track.id?'':id));}await audioStore('delete',track.id);setTracks(t=>t.filter(item=>item.id!==track.id));URL.revokeObjectURL(track.url);}catch{setMessage('Löschen fehlgeschlagen.');}}
 async function playPad(i:number){const id=pads[i],track=tracks.find(t=>t.id===id);if(!track||!jr.current)return;if(padActive===i){jr.current.pause();jr.current.currentTime=0;setPadActive(null);return;}jr.current.pause();jr.current.src=track.url;jr.current.currentTime=0;setPadActive(i);await toggle(2);}
 const select=(value:string,set:(value:string)=>void)=> <select value={value} onChange={e=>{generation.current++;set(e.target.value);}}><option value="">Datei auswählen</option>{tracks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>;
 return <section className="speaker-dj"><h2>Musik & Jingles</h2><div className="speaker-decks">{[a,b].map((id,i)=>{
 const track=tracks.find(t=>t.id===id);return <div className={'speaker-deck speaker-deck--'+i} key={i}><strong>PLAYER {i===0?'A':'B'}</strong>{select(id,value=>{refs[i].current?.pause();i===0?setA(value):setB(value);})}<audio ref={refs[i]} src={track?.url} preload="metadata" onPlay={()=>setPlaying(p=>p.map((v,index)=>index===i?true:v))} onPause={()=>setPlaying(p=>p.map((v,index)=>index===i?false:v))} onEnded={()=>setPlaying(p=>p.map((v,index)=>index===i?false:v))} onTimeUpdate={e=>{const el=e.currentTarget;setTimes(t=>t.map((v,index)=>index===i?[el.currentTime,el.duration]:v));}} onLoadedMetadata={e=>{const el=e.currentTarget;setTimes(t=>t.map((v,index)=>index===i?[0,el.duration]:v));}}/><p>{clock(times[i][0])} / {clock(times[i][1])}</p><input aria-label={'Position Player '+(i===0?'A':'B')} type="range" min={0} max={Number.isFinite(times[i][1])?times[i][1]:0} step=".1" value={times[i][0]} onChange={e=>{if(refs[i].current)refs[i].current.currentTime=Number(e.target.value);}}/><div className="speaker-deck-buttons"><button type="button" disabled={!track} onClick={()=>toggle(i)} aria-label={playing[i]?'Pause':'Wiedergabe'}>{playing[i]?<Pause/>:<Play/>}</button><button type="button" onClick={()=>{generation.current++;refs[i].current?.pause();if(refs[i].current)refs[i].current.currentTime=0;}} aria-label="Player stoppen"><Square/></button><input aria-label={'Lautstärke Player '+(i===0?'A':'B')} type="range" min={0} max={1} step=".01" value={i===0?volA:volB} onChange={e=>i===0?setVolA(Number(e.target.value)):setVolB(Number(e.target.value))}/></div></div>;})}</div>
 <label className="speaker-crossfade">A <span>Überblendung<input aria-label="Überblendung A zu B" type="range" min={0} max={1} step=".01" value={cross} onChange={e=>setCross(Number(e.target.value))}/></span> B</label>
 <div className="speaker-audio-actions"><button type="button" aria-pressed={speaking} className={speaking?'active':''} onClick={()=>setSpeaking(v=>!v)}><Mic/>Sprechen · Musik {speaking?'wieder laut':'leiser'}</button><button type="button" className="speaker-stop" onClick={stop}><Square/>ALLES STOPP</button></div>
 <audio ref={jr} onEnded={()=>setPadActive(null)}/><div className="speaker-pads">{PAD_NAMES.map((name,i)=><div key={name}><button type="button" className={padActive===i?'active':''} disabled={!pads[i]} onClick={()=>playPad(i)}>{name} · {padActive===i?'Stopp':'Start'}</button>{select(pads[i],value=>{if(padActive===i){jr.current?.pause();setPadActive(null);}setPads(p=>p.map((id,index)=>index===i?value:id));})}</div>)}</div>
 <div className="speaker-playlist"><h3>Lokale Audiobibliothek</h3><label className="speaker-upload"><Upload/>Audiodateien hinzufügen<input type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac" onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label>{tracks.map(t=><div className="speaker-track" key={t.id}><span>{t.name}</span><button type="button" onClick={()=>{ar.current?.pause();setA(t.id);}}>A laden</button><button type="button" onClick={()=>{br.current?.pause();setB(t.id);}}>B laden</button><button type="button" aria-label={t.name+' entfernen'} onClick={()=>remove(t)}><Trash2/></button></div>)}<p className="speaker-hint">Audiodateien bleiben auf diesem Gerät, getrennt nach Konto und Mannschaft. Wiedergabe startet nur per Taste. Am Mikrofon deiner Anlage sprichst weiterhin du.</p></div>
 {message?<p role="status" className="speaker-message">{message}</p>:null}
 </section>;
}
