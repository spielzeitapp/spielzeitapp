import React, {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Volume2,VolumeX} from 'lucide-react';
import type {FieldSlotId} from '../../types/match';
import {fetchRemoteMatchBlocks} from '../../lib/tournamentLineupTemplates';
import {readMatchLineupVariants,writeMatchLineupVariants,type StoredMatchLineupVariants} from '../../lib/matchLineupVariants';
import {planBlockChange,type BlockChange} from '../../lib/tournamentBlocks';
import {tournamentBlockReminder} from '../../lib/tournamentBlockReminder';
import {dsPrimaryCtaClass} from '../../lib/premiumDesignSystem';
function readProgress(matchId:string): {next:1|2;last:number}|null {try {const p=JSON.parse(localStorage.getItem(`spielzeit:block-progress:${matchId}`)||'null');return p&&(p.next===1||p.next===2)&&Number.isFinite(p.last)?p:null;}catch{return null;}}
type Props={matchId:string;seconds:number;running?:boolean;current:Record<FieldSlotId,string|null>;squad:string[];name:(id:string)=>string;busy:boolean;onApply:(changes:BlockChange[],slots:Record<FieldSlotId,string|null>)=>Promise<boolean>;basePath:string};
export function TournamentBlockControl({matchId,seconds,running=true,current,squad,name,busy,onApply,basePath}:Props) {
 const [remote,setRemote]=useState<StoredMatchLineupVariants|null>(null);
 const stored=remote??readMatchLineupVariants(matchId);
 const [next,setNext]=useState<1|2>(()=>readProgress(matchId)?.next ?? (stored?.startVariant===2?1:2));
 const [minutes,setMinutes]=useState(()=>{try{return Math.max(1,Math.min(30,Number(localStorage.getItem(`spielzeit:block-interval:${matchId}`))||6));}catch{return 6;}});
 const changeMinutes=(value:number)=>{setMinutes(value);try{localStorage.setItem(`spielzeit:block-interval:${matchId}`,String(value));}catch{}};
 const [keepKeeper,setKeepKeeper]=useState(true);
 const [last,setLast]=useState<number|null>(()=>readProgress(matchId)?.last??null);
 const [preview,setPreview]=useState(false),[review,setReview]=useState('');
 const [error,setError]=useState<string|null>(null),[sound,setSound]=useState(false),[soundError,setSoundError]=useState(false);
 const audio=useRef<AudioContext|null>(null),sounded=useRef<string|null>(null);
 const reminder=tournamentBlockReminder(seconds,last,minutes);
 useEffect(()=>{setRemote(null);let active=true;void fetchRemoteMatchBlocks(matchId).then(value=>{if(active&&value){setRemote(value);writeMatchLineupVariants(matchId,value);if(!readProgress(matchId)){const members=(slots:Record<FieldSlotId,string|null>)=>Object.values(slots).filter(Boolean).sort().join('|');const actual=([1,2] as const).find(n=>members(value.variants[n].slots)===members(current));setNext((actual??value.startVariant)===2?1:2);}}});return()=>{active=false;};},[matchId]);
 useEffect(()=>()=>{void audio.current?.close().catch(()=>{});},[]);
 const prepareSound=async()=>{try{const Ctor=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Ctor)throw new Error();audio.current??=new Ctor();await audio.current.resume();if(audio.current.state!=='running')throw new Error();setSoundError(false);return audio.current;}catch{setSoundError(true);return null;}};
 const beep=(ctx:AudioContext)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.setValueAtTime(850,ctx.currentTime);osc.frequency.linearRampToValueAtTime(1100,ctx.currentTime+.25);gain.gain.setValueAtTime(.12,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.65);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.65);};
 let plan:ReturnType<typeof planBlockChange>|null=null,reason='';
 try{if(stored)plan=planBlockChange(current,stored.variants[next].slots,squad,keepKeeper);}catch(e){reason=(e as Error).message;}
 useEffect(()=>{
  const cue=`${last??0}:${minutes}`;
  if(!sound||!running||!reminder.due||!plan?.changes.length||!stored||stored.lineupMode==='single'||document.visibilityState==='hidden'||sounded.current===cue)return;
  if(audio.current?.state==='running'){beep(audio.current);sounded.current=cue;}
  else setSoundError(true);
 },[sound,running,reminder.due,last,minutes,stored,Boolean(plan?.changes.length)]);
 const field=Object.values(current).filter(Boolean).sort().join('|');
 const sameBlocks=stored&&Object.values(stored.variants[1].slots).filter(Boolean).sort().join('|')===Object.values(stored.variants[2].slots).filter(Boolean).sort().join('|');
 const activeBlock=stored?([stored.startVariant,stored.startVariant===1?2:1] as const).find(n=>Object.values(stored.variants[n].slots).filter(Boolean).sort().join('|')===field):undefined;
 if(stored?.lineupMode==='single')return null;
 const apply=async()=>{
  if(!plan||busy)return;
  if(!preview){setReview(JSON.stringify(plan));setPreview(true);return;}
  if(review!==JSON.stringify(plan)){setError('Aufstellung geändert. Bitte Wechsel erneut prüfen.');setReview(JSON.stringify(plan));return;}
  setError(null);
  try{if(await onApply(plan.changes,plan.slots)){setLast(seconds);setNext(next===1?2:1);try{localStorage.setItem(`spielzeit:block-progress:${matchId}`,JSON.stringify({next:next===1?2:1,last:seconds}));}catch{}setPreview(false);}}
  catch(e){setError((e as Error).message);}
 };
 return <section aria-label="Blockwechsel" className="rounded-2xl border sz-club-surface p-3 text-white">
  <div className="flex items-center justify-between gap-2 text-sm"><strong className="rounded-lg bg-emerald-950/60 px-2 py-1 text-emerald-300">{sameBlocks?'A / B identisch':activeBlock?`Block ${activeBlock===1?'A':'B'} aktiv`:'Individuell angepasst'}</strong><span role="timer" className={`font-bold tabular-nums ${reminder.due?'text-amber-200':'text-white/80'}`}>{reminder.due?'Wechsel fällig':`Wechsel in ${reminder.label}`}</span></div>
  <div className="mt-3 flex items-center gap-2"><button type="button" disabled={busy||!plan||!plan.changes.length} className={`${dsPrimaryCtaClass()} min-h-11 min-w-0 flex-1 rounded-xl px-3 py-2 text-base font-bold disabled:opacity-40`} onClick={()=>void apply()}>{busy?'Speichern…':preview?'Wechsel bestätigen':`Block ${next===1?'A':'B'} einsetzen`}</button><button type="button" aria-label={sound?'Signalton ausschalten':'Signalton einschalten'} aria-pressed={sound} onClick={async()=>{if(sound){setSound(false);return;}const ctx=await prepareSound();if(ctx){beep(ctx);setSound(true);}}} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${sound?'border-emerald-500 text-emerald-300':'border-white/20 text-white/60'}`}>{sound?<Volume2 size={21}/>:<VolumeX size={21}/>}</button></div>
  <p className="mt-2 text-sm text-white/70">Jederzeit vorzeitig wechseln – auch nach 3 Minuten.</p>
  {reminder.due?<p role="status" className="mt-2 text-sm text-amber-200">Blockwechsel prüfen und bestätigen.</p>:null}
  {!stored?<Link className="mt-2 block text-sm underline" to={`${basePath}/match-lineup?matchId=${encodeURIComponent(matchId)}`}>Zuerst Block A / B speichern →</Link>:reason?<p className="mt-2 text-sm text-amber-200">{reason}</p>:plan?.changes.length===0?<p className="mt-2 text-sm text-white/60">{sameBlocks?'Block A und B enthalten dieselben Spieler. Für einen Blockwechsel unterschiedliche Spieler einplanen oder über „Wechsel“ einzeln tauschen.':'Dieser Block steht bereits auf dem Feld. Wähle den anderen Block oder nutze „Wechsel“.'}</p>:null}
  {preview&&plan?<div className="mt-3 rounded-xl bg-black/30 p-3"><ul className="space-y-2 text-sm">{plan.changes.map(c=><li key={c.outId}>{name(c.outId)} raus → {name(c.inId)} rein</li>)}</ul><button type="button" className="mt-2 min-h-11 text-sm underline" onClick={()=>setPreview(false)}>Abbrechen</button></div>:null}
  {error?<p role="alert" className="mt-2 text-sm text-red-200">{error}</p>:null}
  {soundError?<p role="status" className="mt-2 text-sm text-amber-200">Ton nicht verfügbar. Signalton erneut einschalten und Lautstärke prüfen.</p>:null}
  <details className="mt-2 text-sm text-white/65"><summary className="cursor-pointer py-2">Alle {minutes} Min. · Einstellungen</summary><div className="mt-2 space-y-3"><div className="flex gap-2" aria-label="Erinnerungsintervall">{[3,6,9].map(n=><button type="button" key={n} aria-pressed={minutes===n} onClick={()=>changeMinutes(n)} className={`min-h-11 rounded-lg border px-4 ${minutes===n?'sz-club-tab-active':'border-white/20'}`}>{n} Min.</button>)}</div><label className="flex items-center gap-2">Intervall <input aria-label="Blockwechsel nach Minuten" className="min-h-11 w-16 rounded-lg border border-white/20 bg-black p-2 text-base" type="number" min={1} max={30} value={minutes} onChange={e=>changeMinutes(Math.max(1,Math.min(30,Number(e.target.value)||6)))}/> Min.</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={keepKeeper} disabled={busy} onChange={e=>{setKeepKeeper(e.target.checked);setPreview(false);}}/>Torwart bleibt im Tor</label><div className="flex gap-2">{([1,2] as const).map(n=><button key={n} type="button" disabled={busy} onClick={()=>{setNext(n);setPreview(false);}} aria-pressed={next===n} className={`min-h-11 rounded-lg border px-3 ${next===n?'sz-club-tab-active':'border-white/15'}`}>Block {n===1?'A':'B'}</button>)}</div><p>Signalton bei geöffneter Ansicht. Die Spieluhr steuert den Countdown; in der Pause bleibt er stehen. Einzelwechsel bleiben jederzeit möglich.</p></div></details>
 </section>;
}
