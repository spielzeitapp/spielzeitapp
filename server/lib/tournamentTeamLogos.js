/** Public image URLs only; tournament logos never change the club's saved identity. */
export function tournamentLogoUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function tournamentTeamLogos(analysis) {
  return Object.fromEntries((analysis?.teams ?? []).flatMap((team) => {
    const url = tournamentLogoUrl(team.logoUrl);
    return typeof team.teamName === 'string' && url ? [[team.teamName, url]] : [];
  }));
}
