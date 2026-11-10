type Club = {name?: string | null};
type ClubTeam = {clubs?: Club | Club[] | null};

export function clubNameForTeam(team?: ClubTeam | null): string | null {
  const club = Array.isArray(team?.clubs) ? team.clubs[0] : team?.clubs;
  return club?.name?.trim() || null;
}

/** Qualify short team labels without renaming independent SPG/NSG display names. */
export function formatClubTeamName(clubName?: string | null, teamName?: string | null): string {
  const club = (clubName ?? '').trim().replace(/\s+/g, ' ');
  const team = (teamName ?? '').trim().replace(/\s+/g, ' ');
  if (!team) return club || 'Team';
  if (!club) return team;
  const shortLabel = /^(?:(?:FR|Frauen|Herren|KM|Kampfmannschaft|Res\.?|Reserve|II|III|IV|U\s*\d{1,2}[AB]?|[ABC]|\d+)(?:[\s·/–-]+|$))+$/i;
  return shortLabel.test(team) ? `${club} ${team}` : team;
}

/** Age belongs on the subtitle, including ÖFB-style names such as U16-FR. */
export function formatClubTeamHeading(clubName?: string | null, teamName?: string | null): string {
  const name = (teamName ?? '').replace(/\bU\s*\d{1,2}[AB]?\b/gi, ' ')
    .replace(/^[\s·/–-]+|[\s·/–-]+$/g, '').replace(/\s+/g, ' ').trim();
  return formatClubTeamName(clubName, name);
}

/** The club and season already have their own selectors; retain FR/KM and age. */
export function formatTeamSelectionLabel(clubName?: string | null, teamName?: string | null, ageGroup?: string | null): string {
  const club = (clubName ?? '').trim();
  let name = formatClubTeamHeading(club, teamName);
  if (club && name.toLocaleLowerCase('de') === club.toLocaleLowerCase('de')) name = '';
  else if (club && name.toLocaleLowerCase('de').startsWith(club.toLocaleLowerCase('de') + ' ')) name = name.slice(club.length).trim();
  const age = (ageGroup ?? '').trim();
  return [name, age && name.toLocaleLowerCase('de') !== age.toLocaleLowerCase('de') ? age : ''].filter(Boolean).join(' · ') || club || 'Mannschaft';
}
