import { displayLogoUrl } from '../../lib/logoPreparation';
import React, {useState,useEffect} from 'react';
import type {PublicTournamentMatchDetails} from '../../lib/publicTeamTournament';
function LiveClock({clock}:{clock:PublicTournamentMatchDetails}) {
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!clock.clockRunning)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[clock.clockRunning]);
 const delta=clock.clockRunning&&clock.clockSampledAt?Math.max(0,Math.floor((now-Date.parse(clock.clockSampledAt))/1000)):0;
 const seconds=Math.max(0,clock.elapsedSeconds+(Number.isFinite(delta)?delta:0));
 return <p role="timer" className="mx-auto mt-2 w-fit rounded-full bg-emerald-500/15 px-3 py-1 text-lg font-bold tabular-nums text-[var(--t-live,#15803d)]">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}{!clock.clockRunning?' · Pause':''}</p>;
}
import { getClubLogo, hasKnownClubLogo, PLACEHOLDER_LOGO } from '../../lib/teamLogos';
const key=(name:string)=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\bu\d+\b|\b(fc|sv|sc|spg|uhg|styx|i|ii|iii)\b/g,'').replace(/[^a-z0-9]/g,'');
export function FanTeamLogo({name,logos={},ownName,ownLogo,small=false}:{name:string;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;small?:boolean}) {
 const catalog=Object.entries(logos).find(([n])=>key(n)===key(name))?.[1];
 const src=displayLogoUrl(name===ownName&&ownLogo?ownLogo:hasKnownClubLogo(name)?getClubLogo(name):catalog||PLACEHOLDER_LOGO);
 return <img src={src} alt="" className={`${small?'h-7 w-7':'h-16 w-16 sm:h-20 sm:w-20'} shrink-0 object-contain`} onError={e=>{const img=e.currentTarget;const url=new URL(img.src,window.location.href);if(url.pathname==='/api/tournament-plan-analyze'&&url.searchParams.get('logo')){img.src=url.searchParams.get('logo')!;}else if(!img.src.endsWith(PLACEHOLDER_LOGO))img.src=PLACEHOLDER_LOGO;}}/>;
}
export function TournamentFanFixture({home,away,homeGoals,awayGoals,time,phase,logos,ownName,ownLogo,scorers=[],status,clock,prominent=false}:{home:string;away:string;homeGoals:number|null;awayGoals:number|null;time:string;phase:string;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;scorers?:Array<{name:string;goals:number;example?:boolean}>;status?:string;clock?:PublicTournamentMatchDetails;prominent?:boolean}) {
 return <article className="overflow-hidden rounded-2xl border border-[var(--t-border,rgba(200,35,51,.28))] bg-[image:var(--t-fixture,linear-gradient(135deg,#121114,#270e15))] p-4 text-[var(--t-text,#fff)] shadow-sm"><p className="mb-4 text-sm font-semibold text-[var(--t-muted,#b5b5bc)]">{time} Uhr · {phase}</p><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2"><div className="flex min-w-0 flex-col items-center gap-2 text-center"><FanTeamLogo name={home} logos={logos} ownName={ownName} ownLogo={ownLogo}/><p className="text-base font-bold leading-snug break-words">{home}</p></div><div className="pt-2 text-center"><p className="text-xs font-extrabold uppercase tracking-[.08em] text-[var(--t-accent,#fda4af)]">{status==='live'?'JETZT LIVE':status==='scheduled-live'?'Spielstand offen':homeGoals==null?(prominent?'Nächstes Spiel':'Anpfiff'):'Endstand'}</p><p className={`mt-1 whitespace-nowrap ${prominent ? 'text-[48px] sm:text-[56px]' : 'text-[34px]'} font-extrabold leading-tight tabular-nums`}>{homeGoals==null?(status==='live'||status==='scheduled-live'?'–:–':time):`${homeGoals}:${awayGoals}`}</p>{status==='live'&&clock&&(clock.clockRunning||clock.elapsedSeconds>0)?<LiveClock clock={clock}/>:null}</div><div className="flex min-w-0 flex-col items-center gap-2 text-center"><FanTeamLogo name={away} logos={logos} ownName={ownName} ownLogo={ownLogo}/><p className="text-base font-bold leading-snug break-words">{away}</p></div></div>{scorers.length?<div className="mt-4 border-t border-[var(--t-border,#ffffff24)] pt-3"><p className="text-xs font-bold uppercase tracking-wider text-[var(--t-accent,#fda4af)]">Unsere Torschützen{scorers.some(s=>s.example)?' · TEST-Beispiel':''}</p>{scorers.map(s=><p key={s.name} className="mt-2 text-[15px]">⚽ {s.name}{s.goals>1?` (${s.goals})`:''}</p>)}</div>:null}</article>;
}


/** Compact fixture row; the separate live hero remains the visual focus. */
export function TournamentFanFixtureRow({home,away,time,homeGoals,awayGoals,logos,ownName,ownLogo,groupLabel,scorers=[]}:{home:string;away:string;time:string;homeGoals:number|null;awayGoals:number|null;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;groupLabel?:string|null;scorers?:Array<{name:string;goals:number}>}) {
 return <article className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-3 shadow-sm">
  <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_minmax(0,1fr)_0.75rem] items-center gap-2 text-sm">
   <span className="flex flex-col font-bold tabular-nums text-[var(--t-muted)]"><span>{time}</span>{groupLabel?<span className="text-xs font-medium">Gr. {groupLabel}</span>:null}</span>
   <span className="flex min-w-0 items-center gap-1.5"><FanTeamLogo name={home} logos={logos} ownName={ownName} ownLogo={ownLogo} small/><span className="truncate font-bold" title={home}>{home}</span></span>
   <strong className="whitespace-nowrap rounded-md bg-[var(--t-player-badge)] px-2 py-1 text-base tabular-nums">{homeGoals==null?'–':`${homeGoals}:${awayGoals}`}</strong>
   <span className="flex min-w-0 items-center justify-end gap-1.5"><span className="truncate font-bold" title={away}>{away}</span><FanTeamLogo name={away} logos={logos} ownName={ownName} ownLogo={ownLogo} small/></span>
   <span aria-hidden className="text-[var(--t-accent)]">›</span>
  </div>
  {scorers.length ? <p className="mt-2 pl-12 text-sm text-[var(--t-muted)]">⚽ {scorers.map(s=>`${s.name}${s.goals>1?` (${s.goals})`:''}`).join(' · ')}</p> : null}
 </article>;
}
