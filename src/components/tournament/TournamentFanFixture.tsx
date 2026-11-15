import { tournamentTeamLabel } from '../../lib/tournamentDisplay';
import { displayLogoUrl } from '../../lib/logoPreparation';
import React, {useState,useEffect} from 'react';
import type {PublicTournamentMatchDetails} from '../../lib/publicTeamTournament';
function LiveClock({clock,prominent=false}:{clock:PublicTournamentMatchDetails;prominent?:boolean}) {
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!clock.clockRunning)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[clock.clockRunning]);
 const delta=clock.clockRunning&&clock.clockSampledAt?Math.max(0,Math.floor((now-Date.parse(clock.clockSampledAt))/1000)):0;
 const seconds=Math.max(0,clock.elapsedSeconds+(Number.isFinite(delta)?delta:0));
 return <p role="timer" className={`mt-1 text-base font-bold tabular-nums ${prominent?'inline-block rounded-full bg-emerald-500/15 px-3 py-0.5 text-[var(--t-live,#15803d)]':'text-[var(--t-accent)]'}`}>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}{!clock.clockRunning?' · Pause':''}</p>;
}
import { getClubLogo, hasKnownClubLogo, PLACEHOLDER_LOGO } from '../../lib/teamLogos';
const key=(name:string)=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\bu\d+\b|\b(fc|sv|sc|spg|uhg|styx|i|ii|iii)\b/g,'').replace(/[^a-z0-9]/g,'');
export function FanTeamLogo({name,logos={},ownName,ownLogo,small=false}:{name:string;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;small?:boolean}) {
 const catalog=Object.entries(logos).find(([n])=>key(n)===key(name))?.[1];
 const src=displayLogoUrl(name===ownName&&ownLogo?ownLogo:hasKnownClubLogo(name)?getClubLogo(name):catalog||PLACEHOLDER_LOGO);
 return <img src={src} alt="" className={`${small?'h-7 w-7':'h-16 w-16 sm:h-20 sm:w-20'} shrink-0 object-contain`} onError={e=>{const img=e.currentTarget;const url=new URL(img.src,window.location.href);if(url.pathname==='/api/tournament-plan-analyze'&&url.searchParams.get('logo')){img.src=url.searchParams.get('logo')!;}else if(!img.src.endsWith(PLACEHOLDER_LOGO))img.src=PLACEHOLDER_LOGO;}}/>;
}
export function TournamentFanFixture({home,away,homeGoals,awayGoals,time,phase,logos,ownName,ownLogo,scorers=[],status,clock,prominent=false}:{home:string;away:string;homeGoals:number|null;awayGoals:number|null;time:string;phase:string;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;scorers?:Array<{name:string;goals:number;example?:boolean}>;status?:string;clock?:PublicTournamentMatchDetails;prominent?:boolean}) {
 return <article className="overflow-hidden rounded-xl border border-[var(--t-border,rgba(200,35,51,.28))] bg-[image:var(--t-fixture,linear-gradient(135deg,#121114,#270e15))] p-3 text-[var(--t-text,#fff)] shadow-sm">
  {!prominent?<p className="mb-3 text-sm font-semibold text-[var(--t-muted)]">{time} Uhr · {phase}</p>:null}
  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
   <div className="flex min-w-0 flex-col items-center gap-1 text-center"><FanTeamLogo name={home} logos={logos} ownName={ownName} ownLogo={ownLogo}/><p title={home} className="text-[15px] font-bold leading-tight break-words">{prominent?tournamentTeamLabel(home):home}</p></div>
   <div className="text-center"><p className={prominent?'rounded-md bg-[var(--t-accent)] px-2 py-0.5 text-[11px] font-extrabold uppercase text-white':'text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--t-accent)]'}>{status==='live'?(prominent?'Jetzt live':'LIVE'):homeGoals==null?'Beginn':'Endstand'}</p><p className={`mt-1 whitespace-nowrap ${prominent?'text-[48px] sm:text-[56px]':'text-[34px]'} font-extrabold leading-tight tabular-nums`}>{homeGoals==null?time:`${homeGoals}:${awayGoals}`}</p>{status==='live'&&clock?<LiveClock clock={clock} prominent={prominent}/>:null}</div>
   <div className="flex min-w-0 flex-col items-center gap-1 text-center"><FanTeamLogo name={away} logos={logos} ownName={ownName} ownLogo={ownLogo}/><p title={away} className="text-[15px] font-bold leading-tight break-words">{prominent?tournamentTeamLabel(away):away}</p></div>
  </div>
  {scorers.length?<div className="mt-2 border-t border-[var(--t-border)] pt-2">{!prominent?<p className="text-xs font-bold uppercase tracking-wider text-[var(--t-accent)]">Unsere Torschützen{scorers.some(s=>s.example)?' · TEST-Beispiel':''}</p>:null}{scorers.map(s=><p key={s.name} className="mt-1 text-sm">⚽ {s.name}{s.goals>1?` (${s.goals})`:''}</p>)}</div>:null}
 </article>;

}


/** Compact fixture row; the separate live hero remains the visual focus. */
export function TournamentFanFixtureRow({home,away,time,homeGoals,awayGoals,logos,ownName,ownLogo,groupLabel,scorers=[]}:{home:string;away:string;time:string;homeGoals:number|null;awayGoals:number|null;logos?:Record<string,string>;ownName?:string|null;ownLogo?:string|null;groupLabel?:string|null;scorers?:Array<{name:string;goals:number}>}) {
 const completed=homeGoals!=null && awayGoals!=null;
 const ownGoals=home===ownName?homeGoals:away===ownName?awayGoals:null;
 const otherGoals=home===ownName?awayGoals:away===ownName?homeGoals:null;
 const resultTone=ownGoals!=null&&otherGoals!=null?(ownGoals>otherGoals?'bg-emerald-500/15':ownGoals<otherGoals?'bg-red-500/10':'bg-[var(--t-player-badge)]'):'bg-[var(--t-player-badge)]';
 return <article className="tournament-fixture-row rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-2.5 py-2">
  <div className="grid grid-cols-[2.4rem_minmax(0,1fr)_auto_minmax(0,1fr)_0.6rem] items-center gap-1.5 text-sm">
   <span title={groupLabel?`Gruppe ${groupLabel}`:undefined} className="font-bold tabular-nums text-[var(--t-muted)]">{time}</span>
   <span className="flex min-w-0 items-center gap-1.5"><span className="shrink-0 [&_img]:!h-6 [&_img]:!w-6"><FanTeamLogo name={home} logos={logos} ownName={ownName} ownLogo={ownLogo} small/></span><span className="truncate font-bold" title={home}>{tournamentTeamLabel(home)}</span></span>
   <strong className={`whitespace-nowrap rounded-md ${completed?resultTone:''} ${completed?'px-1.5 py-0.5':'px-0.5'} text-sm tabular-nums`}>{completed?`${homeGoals}:${awayGoals}`:'–'}</strong>
   <span className="flex min-w-0 items-center justify-end gap-1.5"><span className="truncate font-bold" title={away}>{tournamentTeamLabel(away)}</span><span className="shrink-0 [&_img]:!h-6 [&_img]:!w-6"><FanTeamLogo name={away} logos={logos} ownName={ownName} ownLogo={ownLogo} small/></span></span>
   <span aria-hidden className="text-lg leading-none text-[var(--t-accent)]">›</span>
  </div>
  {scorers.length?<p className="mt-1 pl-[2.8rem] text-[13px] leading-snug text-[var(--t-muted)]">⚽ {scorers.map(s=>`${s.name}${s.goals>1?` (${s.goals})`:''}`).join(' · ')}</p>:null}
 </article>;
}
