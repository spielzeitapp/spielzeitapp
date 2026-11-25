export function publicTeamTournamentPath(publicId: string): string {
  return `/turnier/${encodeURIComponent(String(publicId).trim())}`;
}
