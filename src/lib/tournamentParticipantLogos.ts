import { tournamentTeamLogos } from '../../server/lib/tournamentTeamLogos.js';
import { hasKnownClubLogo } from './teamLogos';
function participantKey(name: string): string {
  return name.trim().toLowerCase().replace(/ß/g, 'ss').replace(/\s+/g, ' ');
}

/** Hide a leftover club-only entry when the organizer lists its two distinct teams. */
export function filterOfficialTeamVariants<T extends { team_name: string }>(
  rows: T[],
  officialTeamNames: string[],
): T[] {
  const official = new Set(officialTeamNames.map(participantKey));
  const saved = new Set(rows.map(row => participantKey(row.team_name)));
  return rows.filter(row => {
    const key = participantKey(row.team_name);
    if (official.has(key)) return true;
    return !['schwarz', 'weiss'].every(color => {
      const variant = `${key} ${color}`;
      return official.has(variant) && saved.has(variant);
    });
  });
}

export function mergeTournamentParticipantLogos<T extends {team_name: string; logo_url?: string | null}>(rows: T[], analysis: Parameters<typeof tournamentTeamLogos>[0]): T[] {
  const logos = tournamentTeamLogos(analysis);
  return rows.map(row => ({ ...row, logo_url: row.logo_url || (hasKnownClubLogo(row.team_name) ? null : logos[row.team_name] ?? null) }));
}
