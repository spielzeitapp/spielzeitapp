import React from 'react';
import { PLACEHOLDER_LOGO } from '../../lib/teamLogos';

export type CompetitionTableRow = {
  rank: number; team: string; logo: string | null; played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
};

/** Shared presentation; data fetching stays outside this component. */
export function CompetitionStandingsTable({ rows, ourTeam, resolveLogo }: {
  rows: CompetitionTableRow[]; ourTeam: string;
  resolveLogo?: (row: CompetitionTableRow) => string | null;
}) {
  const columns = ['Sp', 'Pkt', '+/−', 'S', 'U', 'N', 'Tore'];
  return <div data-competition-standings>
    <p className="mb-2 text-xs text-white/55">Seitlich wischen für weitere Statistiken →</p>
    <div role="region" aria-label="Ligatabelle · seitlich scrollbar" tabIndex={0} className="overflow-x-auto overscroll-x-contain rounded-xl border border-white/10 bg-black/25">
      <table className="w-full min-w-[740px] text-base tabular-nums text-white">
        <thead className="border-b border-white/15 text-sm text-white/60"><tr>
          <th scope="col" className="px-3 py-3 text-left">#</th><th scope="col" className="px-3 py-3 text-left">Mannschaft</th>
          {columns.map(label=><th key={label} scope="col" className="px-3 py-3 text-right">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map(row=><tr key={`${row.rank}-${row.team}`} className={`border-b border-white/10 last:border-0 ${ourTeam.trim()&&row.team.toLowerCase().includes(ourTeam.toLowerCase())?'bg-[rgb(var(--club-primary-rgb)/0.24)] font-bold':''}`}>
          <td className="px-3 py-3 text-lg">{row.rank}</td>
          <th scope="row" className="px-3 py-3 text-left font-semibold"><span className="flex min-w-[215px] items-center gap-3"><img src={resolveLogo?.(row)??row.logo??PLACEHOLDER_LOGO} alt="" className="h-9 w-9 shrink-0 object-contain" onError={e=>{if(!e.currentTarget.src.endsWith(PLACEHOLDER_LOGO))e.currentTarget.src=PLACEHOLDER_LOGO;}}/><span>{row.team}</span></span></th>
          <td className="px-3 py-3 text-right">{row.played}</td>
          <td className="px-3 py-3 text-right text-xl font-bold">{row.points}</td>
          <td className="px-3 py-3 text-right whitespace-nowrap">{row.goalDifference>0?'+':''}{row.goalDifference}</td>
          <td className="px-3 py-3 text-right">{row.won}</td><td className="px-3 py-3 text-right">{row.drawn}</td><td className="px-3 py-3 text-right">{row.lost}</td>
          <td className="px-3 py-3 text-right whitespace-nowrap">{row.goalsFor}:{row.goalsAgainst}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
