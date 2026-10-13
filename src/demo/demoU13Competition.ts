import type { CompetitionTableRow } from '../components/schedule/CompetitionStandingsTable';

export const DEMO_U13_TEAM = 'FC Demoheim';
export const DEMO_U13_TEAMS = [DEMO_U13_TEAM, 'FC Demowest', 'FC Demonord', 'FC Demowiese', 'FC Demotal', 'FC Demopark'];
export const DEMO_U13_RESULTS = [
  { round: 1, home: 0, away: 1, homeGoals: 3, awayGoals: 1 },
  { round: 1, home: 2, away: 3, homeGoals: 2, awayGoals: 0 },
  { round: 1, home: 4, away: 5, homeGoals: 1, awayGoals: 1 },
  { round: 2, home: 0, away: 2, homeGoals: 1, awayGoals: 1 },
  { round: 2, home: 1, away: 4, homeGoals: 2, awayGoals: 0 },
  { round: 2, home: 3, away: 5, homeGoals: 2, awayGoals: 1 },
  { round: 3, home: 0, away: 4, homeGoals: 4, awayGoals: 0 },
  { round: 3, home: 2, away: 5, homeGoals: 3, awayGoals: 2 },
  { round: 3, home: 1, away: 3, homeGoals: 0, awayGoals: 2 },
];

/** Fictitious local results only; never calls ÖFB or the team database. */
export function buildDemoU13Table(): CompetitionTableRow[] {
  const rows = DEMO_U13_TEAMS.map(team => ({ rank: 0, team, logo: null,
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }));
  for (const match of DEMO_U13_RESULTS) {
    for (const [index, scored, conceded] of [[match.home, match.homeGoals, match.awayGoals], [match.away, match.awayGoals, match.homeGoals]]) {
      const row = rows[index];
      row.played++; row.goalsFor += scored; row.goalsAgainst += conceded;
      if (scored > conceded) { row.won++; row.points += 3; }
      else if (scored === conceded) { row.drawn++; row.points++; }
      else row.lost++;
      row.goalDifference = row.goalsFor - row.goalsAgainst;
    }
  }
  return rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
