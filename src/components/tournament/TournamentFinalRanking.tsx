import React from 'react';
import { Medal, Trophy } from 'lucide-react';
import { FanTeamLogo } from './TournamentFanFixture';

type Props = {
  ranking: Array<{rank:number;teamName:string}>;
  logos?: Record<string,string>;
  ownName?: string | null;
  ownLogo?: string | null;
};
const medals: Record<number,{label:string;background:string;color:string}> = {
  1:{label:'Gold',background:'#fef3c7',color:'#92400e'},
  2:{label:'Silber',background:'#e2e8f0',color:'#475569'},
  3:{label:'Bronze',background:'#f7dbc5',color:'#9a3412'},
};

export function TournamentFinalRanking({ranking,logos,ownName,ownLogo}:Props) {
  return <section className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4">
    <h2 className="mb-4 flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-[.14em] text-[var(--t-accent)]"><Trophy size={20} aria-hidden/>Endplatzierung</h2>
    <ol className="space-y-2.5" aria-label="Endplatzierung des Turniers">
      {[...ranking].sort((a,b)=>a.rank-b.rank).map(row=>{
        const medal=medals[row.rank];
        const own=Boolean(ownName)&&row.teamName.trim().toLocaleLowerCase('de')===ownName!.trim().toLocaleLowerCase('de');
        return <li key={`${row.rank}-${row.teamName}`} value={row.rank} aria-label={`${row.rank}. Platz: ${row.teamName}${own?', unser Team':''}`} className="flex min-h-20 items-center gap-3 rounded-xl border p-3" style={{borderColor:own?'var(--t-accent)':'var(--t-border)',background:own?'var(--t-fixture)':'var(--t-surface)'}}>
          <span role="img" aria-label={`${row.rank}. Platz${medal?` · ${medal.label}`:''}`} className="flex h-11 w-11 shrink-0 items-center justify-center gap-0.5 rounded-full font-black tabular-nums" style={medal?{background:medal.background,color:medal.color}:{background:'var(--t-player-badge)',color:'var(--t-muted)'}}>{medal?<Medal size={21} aria-hidden/>:null}<span aria-hidden>{row.rank}{medal?'':'.'}</span></span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center [&_img]:h-10 [&_img]:w-10"><FanTeamLogo name={row.teamName} logos={logos} ownName={ownName} ownLogo={ownLogo} small/></span>
          <span className="min-w-0 flex-1"><span className="block break-words text-[15px] font-bold leading-snug">{row.teamName}</span>{own?<span className="mt-1 block text-xs font-bold text-[var(--t-accent)]">Unser Team</span>:row.rank===1?<span className="mt-1 block text-xs font-bold text-[var(--t-muted)]">Turniersieger</span>:null}</span>
        </li>;
      })}
    </ol>
  </section>;
}
