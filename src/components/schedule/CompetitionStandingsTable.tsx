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
  return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/25">
          <table className="w-full min-w-[460px] text-xs tabular-nums text-white sm:text-sm">
            <thead className="border-b border-white/15 text-white/55"><tr>
              <th scope="col" className="p-2 text-left">#</th><th scope="col" className="p-2 text-left">Mannschaft</th>
              <th scope="col" className="p-2 text-right">Sp</th><th scope="col" className="p-2 text-right">S</th>
              <th scope="col" className="p-2 text-right">U</th><th scope="col" className="p-2 text-right">N</th>
              <th scope="col" className="p-2 text-right">Tore</th><th scope="col" className="p-2 text-right">+/−</th><th scope="col" className="p-2 text-right">Pkt</th>
            </tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={`${row.rank}-${row.team}`} className={`border-b border-white/10 last:border-0 ${row.team.toLowerCase().includes(ourTeam.toLowerCase()) ? 'bg-red-950/55 font-bold' : ''}`}>
                <td className="p-2">{row.rank}</td><th scope="row" className="p-2 text-left font-medium"><span className="flex min-w-[160px] items-center gap-2"><img src={resolveLogo?.(row) ?? row.logo ?? PLACEHOLDER_LOGO} alt="" className="h-7 w-7 shrink-0 object-contain" onError={e => { if (!e.currentTarget.src.endsWith(PLACEHOLDER_LOGO)) e.currentTarget.src = PLACEHOLDER_LOGO; }} /><span>{row.team}</span></span></th>
                <td className="p-2 text-right">{row.played}</td><td className="p-2 text-right">{row.won}</td>
                <td className="p-2 text-right">{row.drawn}</td><td className="p-2 text-right">{row.lost}</td>
                <td className="p-2 text-right whitespace-nowrap">{row.goalsFor}:{row.goalsAgainst}</td>
                <td className="p-2 text-right whitespace-nowrap">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</td>
                <td className="p-2 text-right font-bold">{row.points}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
  );
}
