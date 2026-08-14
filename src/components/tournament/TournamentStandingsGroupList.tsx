import React from 'react';
import {
  formatTournamentGroupRankDisplay,
  type TournamentGroupStandings,
} from '../../lib/tournamentGroupStandings';
import { formatTournamentGoalDifference } from '../../lib/tournamentPlan';
import { TC_SECTION_LABEL } from './tournamentCenterStyles';
import { TournamentClubLogo } from './TournamentClubLogo';

type Props = {
  standings: TournamentGroupStandings;
  compact?: boolean;
  maxRows?: number;
};

export function TournamentStandingsGroupList({
  standings,
  compact = false,
  maxRows,
}: Props) {
  const rows = maxRows != null ? standings.rows.slice(0, maxRows) : standings.rows;

  return (
    <div className={compact ? 'flex flex-col gap-1.5' : 'flex flex-col gap-2'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={TC_SECTION_LABEL}>Gruppe {standings.groupLabel}</p>
        {!compact && standings.ourRank != null ? (
          <p className="text-[12px] font-medium text-white/65">
            {formatTournamentGroupRankDisplay(standings.ourRank, standings.teamCount)}
          </p>
        ) : null}
      </div>
      <ul className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {rows.map((row) => (
          <li
            key={row.teamName}
            className={`rounded-xl border px-3 ${compact ? 'py-2' : 'py-2.5'} ${
              row.isOurTeam
                ? 'border-[rgba(255,71,71,0.28)] bg-[rgba(255,71,71,0.06)]'
                : 'border-white/[0.06] bg-white/[0.02]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <TournamentClubLogo name={row.teamName} size="sm" tone="dark" />
                <div className="min-w-0">
                  <p
                    className={`line-clamp-2 font-semibold leading-snug text-white ${
                      compact ? 'text-[13px]' : 'text-[14px]'
                    }`}
                  >
                    {row.rank}. {row.teamName}
                  </p>
                  <p className={`mt-0.5 tabular-nums text-white/50 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                    {row.played} Sp. · {row.wins}-{row.draws}-{row.losses}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-bold tabular-nums text-white ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
                  {row.points} Pkt.
                </p>
                <p className={`tabular-nums text-white/55 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                  {row.goalsFor}:{row.goalsAgainst} ({formatTournamentGoalDifference(row.goalDifference)})
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
