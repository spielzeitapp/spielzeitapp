import { displayLogoUrl } from '../../lib/logoPreparation';
import React, {useState,useEffect} from 'react';
import type {PublicTournamentMatchDetails} from '../../lib/publicTeamTournament';
function LiveClock({clock}:{clock:PublicTournamentMatchDetails}) {
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!clock.clockRunning)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[clock.clockRunning]);
 const delta=clock.clockRunning&&clock.clockSampledAt?Math.max(0,Math.floor((now-Date.parse(clock.clockSampledAt))/1000)):0;
 const seconds=Math.max(0,clock.elapsedSeconds+(Number.isFinite(delta)?delta:0));
 return <p role="timer" className="mt-2 text-base font-bold tabular-nums text-[var(--t-accent)]">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}{!clock.clockRunning?' · Pause':''}</p>;
}
import { getClubLogo, hasKnownClubLogo, PLACEHOLDER_LOGO } from '../../lib/teamLogos';
const key=(name:string)=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\bu\d+\b|\b(fc|sv|sc|spg|uhg|styx|i|ii|iii)\b/g,'').replace(/[^a-z0-9]/g,'');
export function FanTeamLogo({name,logos={},ownName,ownLogo,small=false}:{name:string;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;small?:boolean}) {
 const catalog=Object.entries(logos).find(([n])=>key(n)===key(name))?.[1];
 const src=displayLogoUrl(name===ownName&&ownLogo?ownLogo:hasKnownClubLogo(name)?getClubLogo(name):catalog||PLACEHOLDER_LOGO);
 return <img src={src} alt="" className={`${small?'h-7 w-7':'h-16 w-16 sm:h-20 sm:w-20'} shrink-0 object-contain`} onError={e=>{const img=e.currentTarget;const url=new URL(img.src,window.location.href);if(url.pathname==='/api/tournament-plan-analyze'&&url.searchParams.get('logo')){img.src=url.searchParams.get('logo')!;}else if(!img.src.endsWith(PLACEHOLDER_LOGO))img.src=PLACEHOLDER_LOGO;}}/>;
}
export function TournamentFanFixture({home,away,homeGoals,awayGoals,time,phase,logos,ownName,ownLogo,scorers=[],status,clock}:{home:string;away:string;homeGoals:number|null;awayGoals:number|null;time:string;phase:string;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;scorers?:Array<{name:string;goals:number;example?:boolean}>;status?:string;clock?:PublicTournamentMatchDetails}) {
 return <article className="overflow-hidden rounded-2xl border border-[var(--t-border,rgba(200,35,51,.28))] bg-[image:var(--t-fixture,linear-gradient(135deg,#121114,#270e15))] p-4 text-[var(--t-text,#fff)] shadow-sm"><p className="mb-4 text-sm font-semibold text-[var(--t-muted,#b5b5bc)]">{time} Uhr · {phase}</p><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2"><div className="flex min-w-0 flex-col items-center gap-2 text-center"><FanTeamLogo name={home} logos={logos} ownName={ownName} ownLogo={ownLogo}/><p className="text-[15px] font-bold leading-snug break-words">{home}</p></div><div className="pt-2 text-center"><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--t-accent,#fda4af)]">{status==='live'?'LIVE':homeGoals==null?'Beginn':'Endstand'}</p>{status==='live'&&clock?<LiveClock clock={clock}/>:null}<p className="mt-1 whitespace-nowrap text-[34px] font-extrabold leading-tight tabular-nums">{homeGoals==null?time:`${homeGoals}:${awayGoals}`}</p></div><div className="flex min-w-0 flex-col items-center gap-2 text-center"><FanTeamLogo name={away} logos={logos} ownName={ownName} ownLogo={ownLogo}/><p className="text-[15px] font-bold leading-snug break-words">{away}</p></div></div>{scorers.length?<div className="mt-4 border-t border-[var(--t-border,#ffffff24)] pt-3"><p className="text-xs font-bold uppercase tracking-wider text-[var(--t-accent,#fda4af)]">Unsere Torschützen{scorers.some(s=>s.example)?' · TEST-Beispiel':''}</p>{scorers.map(s=><p key={s.name} className="mt-2 text-[15px]">⚽ {s.name}{s.goals>1?` (${s.goals})`:''}</p>)}</div>:null}</article>;
}
