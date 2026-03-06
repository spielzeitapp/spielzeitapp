/**
 * Spielplan-Match (Liste/CRUD).
 * Anzeige: homeTeam vs awayTeam, scoreHome : scoreAway.
 * Bei homeAway==="home": homeTeam = unser Team, awayTeam = opponentName.
 * Bei homeAway==="away": homeTeam = opponentName, awayTeam = unser Team.
 */
export interface ScheduleMatch {
  id: string;
  teamId: string;
  homeTeam: string;
  awayTeam: string;
  opponentName: string;
  homeAway: 'home' | 'away';
  kickoffAt: string; // ISO
  status: 'planned' | 'live' | 'finished';
  scoreHome: number;
  scoreAway: number;
}
