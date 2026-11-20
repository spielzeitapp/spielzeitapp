import { formatTeamSeasonContextLabel, type TeamSeasonLabelInput } from './seasonLifecycle';
import { getClubLogo, isPlaceholderLogoUrl } from './teamLogos';

const youthAgeOnly = /^U\s*\d{1,2}(?:[\s·-]*[A-D0-9]+)?$/i;

export function teamSwitcherTitle(input: TeamSeasonLabelInput): string {
  const teamName = input.teamName?.trim();
  const ageInName = teamName && youthAgeOnly.test(teamName) ? teamName : null;
  const displayName = input.displayName?.replace(/\s*[·(]?\s*20\d{2}\/\d{2,4}\s*\)?\s*$/, '').trim();
  return formatTeamSeasonContextLabel({
    ...input,
    teamName: ageInName || !teamName ? input.clubName || 'Mannschaft' : teamName,
    displayName: displayName && !youthAgeOnly.test(displayName) ? displayName : null,
    ageGroup: input.ageGroup || ageInName,
    clubName: null,
  }, { includeSeason: false });
}

export function teamSwitcherLogo(teamName: string, clubName: string, teamId?: string | null, teamLogo?: string | null, clubLogo?: string | null): string {
  const crest = getClubLogo(teamName, { teamId, logoUrl: teamLogo });
  const storedClubLogo = getClubLogo('', { logoUrl: clubLogo });
  // Spielgemeinschaften can carry their own crest even when managed by another club.
  if (!isPlaceholderLogoUrl(crest) && (teamLogo || /^\s*(?:U\d{1,2}\s+)?(?:SPG|NSG)\s/i.test(teamName))) return crest;
  if (!isPlaceholderLogoUrl(storedClubLogo)) return storedClubLogo;
  if (!isPlaceholderLogoUrl(crest)) return crest;
  return getClubLogo(clubName);
}
