import React, { useMemo } from 'react';
import type { Match } from '../../../types/match';
import type { PlayerMatchStats } from '../../../types/stats';
import { computePlayerMatchStats } from '../../../services/statsService';

interface MatchStatsTableProps {
  match: Match;
}

interface PlayerWithStats {
  id: string;
  displayName: string;
  number?: number;
  stats: PlayerMatchStats;
  isStarting: boolean;
}

export const MatchStatsTable: React.FC<MatchStatsTableProps> = ({ match }) => {
  const stats = useMemo(() => computePlayerMatchStats(match), [match]);

  const statsByPlayerId = useMemo(() => {
    const map = new Map<string, PlayerMatchStats>();
    for (const s of stats) {
      map.set(s.playerId, s);
    }
    return map;
  }, [stats]);

  const hasAnyMinutes = match.events.some((e) => e.minute != null);

  const buildTeamPlayers = (
    team: Match['home'] | Match['away'],
    startingIds: string[],
  ): PlayerWithStats[] => {
    const startingSet = new Set(startingIds);
    return team.players.map((player) => {
      const statsForPlayer =
        statsByPlayerId.get(player.id) ??
        ({
          playerId: player.id,
          teamId: team.id,
          goals: 0,
          yellow: 0,
          red: 0,
          subIn: 0,
          subOut: 0,
          minutesPlayed: 0,
        } satisfies PlayerMatchStats);

      return {
        id: player.id,
        displayName: player.display_name ?? player.name ?? 'Spieler',
        number: player.number,
        stats: statsForPlayer,
        isStarting: startingSet.has(player.id),
      };
    });
  };

  const sortPlayers = (players: PlayerWithStats[]): PlayerWithStats[] => {
    const starters = players.filter((p) => p.isStarting);
    const bench = players.filter((p) => !p.isStarting);

    const sortFn = (a: PlayerWithStats, b: PlayerWithStats) => {
      if (a.number != null && b.number != null) {
        return a.number - b.number;
      }
      if (a.number != null) return -1;
      if (b.number != null) return 1;
      return a.displayName.localeCompare(b.displayName);
    };

    starters.sort(sortFn);
    bench.sort(sortFn);

    return [...starters, ...bench];
  };

  const homePlayers = sortPlayers(
    buildTeamPlayers(match.home, match.lineup.homeStarting),
  );
  const awayPlayers = sortPlayers(
    buildTeamPlayers(match.away, match.lineup.awayStarting),
  );

  const renderTable = (title: string, players: PlayerWithStats[]) => {
    if (players.length === 0) {
      return null;
    }

    return (
      <section className="card mt-3">
        <h2 className="card-title mb-2">{title}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="text-[var(--text-sub)] text-[0.7rem] sm:text-xs">
              <tr className="border-b border-[var(--glass-border)]/60">
                <th className="py-1 pr-2 text-left font-normal">Spieler</th>
                <th className="px-1 text-right font-normal">Min</th>
                <th className="px-1 text-right font-normal">Tore</th>
                <th className="px-1 text-right font-normal">Gelb</th>
                <th className="px-1 text-right font-normal">Rot</th>
                <th className="px-1 text-right font-normal">Ein</th>
                <th className="px-1 text-right font-normal">Aus</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-[var(--glass-border)]/30">
                  <td className="py-1 pr-2 text-left">
                    <span className="text-[var(--text-main)]">
                      {player.number != null ? `#${player.number} ` : '– '}
                      {player.displayName}
                    </span>
                  </td>
                  <td className="px-1 text-right text-[var(--text-main)]">
                    {hasAnyMinutes ? player.stats.minutesPlayed : '–'}
                  </td>
                  <td className="px-1 text-right text-[var(--text-main)]">
                    {player.stats.goals || ''}
                  </td>
                  <td className="px-1 text-right text-[var(--text-main)]">
                    {player.stats.yellow || ''}
                  </td>
                  <td className="px-1 text-right text-[var(--text-main)]">
                    {player.stats.red || ''}
                  </td>
                  <td className="px-1 text-right text-[var(--text-main)]">
                    {player.stats.subIn || ''}
                  </td>
                  <td className="px-1 text-right text-[var(--text-main)]">
                    {player.stats.subOut || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-3">
      {renderTable(
        match.home.shortName ?? `${match.home.name} – Heim`,
        homePlayers,
      )}
      {renderTable(
        match.away.shortName ?? `${match.away.name} – Auswärts`,
        awayPlayers,
      )}
    </div>
  );
};

