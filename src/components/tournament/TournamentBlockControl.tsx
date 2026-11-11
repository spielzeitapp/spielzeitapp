import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import type {FieldSlotId} from '../../types/match';
import {readMatchLineupVariants} from '../../lib/matchLineupVariants';
import {planBlockChange, type BlockChange} from '../../lib/tournamentBlocks';
import {dsPrimaryCtaClass} from '../../lib/premiumDesignSystem';
function readProgress(matchId:string): {next:1|2;last:number}|null {try {const p=JSON.parse(localStorage.getItem(`spielzeit:block-progress:${matchId}`)||'null');return p&&(p.next===1||p.next===2)&&Number.isFinite(p.last)?p:null;}catch{return null;}}
type Props = {matchId:string;seconds:number;current:Record<FieldSlotId,string|null>;squad:string[];name:(id:string)=>string;busy:boolean;onApply:(changes:BlockChange[],slots:Record<FieldSlotId,string|null>)=>Promise<boolean>;basePath:string};
export function TournamentBlockControl({matchId,seconds,current,squad,name,busy,onApply,basePath}:Props) {
 const stored=readMatchLineupVariants(matchId);
 const [next,setNext]=useState<1|2>(()=>readProgress(matchId)?.next ?? (stored?.startVariant===2?1:2));
 const [minutes,setMinutes]=useState(6);
 const [keepKeeper,setKeepKeeper]=useState(true);
 const [last,setLast]=useState<number|null>(()=>readProgress(matchId)?.last??null);
 const [preview,setPreview]=useState(false);
 const [review,setReview]=useState('');
 const [error,setError]=useState<string|null>(null);
 let plan:ReturnType<typeof planBlockChange>|null=null; let reason='';
 try {if(stored) plan=planBlockChange(current,stored.variants[next].slots,squad,keepKeeper);} catch(e){reason=(e as Error).message;}
 const due=seconds-(last??0)>=minutes*60;
 return <section className="rounded-2xl border sz-club-surface p-3 text-white">
 <h3 className="font-bold">Blockwechsel</h3>
 <p className="mt-1 text-xs text-white/60">Blockplanung auf diesem Gerät. Einzelwechsel sind weiterhin jederzeit möglich. Spieler, die bleiben, behalten ihre aktuelle Position.</p>
 <Link className="sz-club-link text-sm underline" to={`${basePath}/match-lineup?matchId=${encodeURIComponent(matchId)}`}>Block 1 / Block 2 planen</Link>
 <div className="mt-2 flex flex-wrap gap-2">{([1,2] as const).map(n=><button key={n} type="button" disabled={busy} onClick={()=>{setNext(n);setPreview(false);}} aria-pressed={next===n} className={`rounded-xl border px-3 py-2 text-sm ${next===n?'sz-club-tab-active':'border-white/15'}`}>Block {n}</button>)}</div>
 <label className="mt-2 flex items-center gap-2 text-sm">Erinnerung nach <input className="w-14 rounded border border-white/20 bg-black p-1" type="number" min={1} max={30} value={minutes} onChange={e=>setMinutes(Math.max(1,Math.min(30,Number(e.target.value)||6)))}/> Minuten</label>
 <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={keepKeeper} disabled={busy} onChange={e=>{setKeepKeeper(e.target.checked);setPreview(false);}}/>Torwart bleibt im Tor</label>
 {due&&<p role="status" className="mt-2 text-sm text-amber-200">Zeit für den nächsten Blockwechsel – bitte prüfen und bestätigen.</p>}
 {!stored?<p className="mt-2 text-sm">Zuerst beide Blöcke in der Aufstellung speichern.</p>:reason?<p className="mt-2 text-sm text-amber-200">{reason}</p>:null}
 {plan&&plan.changes.length===0&&<p className="mt-2 text-sm">Dieser Block steht bereits auf dem Feld.</p>}
 {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
 {preview&&plan&&<ul className="my-2 text-sm">{plan.changes.map(c=><li key={c.outId}>{name(c.outId)} raus → {name(c.inId)} rein</li>)}</ul>}
 <button type="button" disabled={busy||!plan||!plan.changes.length} className={`${dsPrimaryCtaClass()} mt-2 w-full rounded-full px-3 py-2 disabled:opacity-40`} onClick={async()=>{if(!preview){setReview(JSON.stringify(plan));setPreview(true);return;} if(!plan)return; if(review!==JSON.stringify(plan)){setError('Aufstellung hat sich geändert. Bitte neue Wechsel prüfen.');setReview(JSON.stringify(plan));return;}setError(null);try {if(await onApply(plan.changes,plan.slots)){setLast(seconds);setNext(next===1?2:1);try{localStorage.setItem(`spielzeit:block-progress:${matchId}`,JSON.stringify({next:next===1?2:1,last:seconds}));}catch{}setPreview(false);}}catch(e){setError((e as Error).message);}}}>{busy?'Wird gespeichert…':preview?'Blockwechsel bestätigen':'Blockwechsel prüfen'}</button>
 </section>;
}
