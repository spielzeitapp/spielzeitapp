export type HeadToHeadMatch = {
  id: string;
  team_season_id: string;
  season_name: string;
  opponent: string;
  match_date: string;
  is_home: boolean | null;
  is_tournament: boolean;
  team_goals: number | null;
  opponent_goals: number | null;
  stored_score_home?: number | null;
  stored_score_away?: number | null;
  side_known?: boolean;
  result_verified?: boolean;
};

export function summarizeHeadToHead(matches: HeadToHeadMatch[]) {
  let wins = 0, draws = 0, losses = 0, goals = 0, conceded = 0, unresolved = 0;
  for (const match of matches) {
    const a = match.team_goals, b = match.opponent_goals;
    if (match.result_verified === false || match.side_known === false || a == null || b == null || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      unresolved++;
      continue;
    }
    goals += a;
    conceded += b;
    if (a > b) wins++;
    else if (a === b) draws++;
    else losses++;
  }
  return { wins, draws, losses, goals, conceded, unresolved, total: matches.length };
}

export function filterHeadToHead(matches: HeadToHeadMatch[], seasonId: string, venue: string) {
  return matches.filter(match => (!seasonId || match.team_season_id === seasonId)
    && (venue === 'all' || (venue === 'home' ? match.is_home === true : match.is_home === false)));
}
