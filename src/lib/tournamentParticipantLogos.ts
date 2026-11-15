import { tournamentTeamLogos } from '../../server/lib/tournamentTeamLogos.js';
import { hasKnownClubLogo } from './teamLogos';
export function mergeTournamentParticipantLogos<T extends {team_name: string; logo_url?: string | null}>(rows: T[], analysis: Parameters<typeof tournamentTeamLogos>[0]): T[] {
  const logos = tournamentTeamLogos(analysis);
  return rows.map(row => ({ ...row, logo_url: row.logo_url || (hasKnownClubLogo(row.team_name) ? null : logos[row.team_name] ?? null) }));
}
