import {
  formatTeamSeasonCompactSwitcherLabel,
  resolveCurrentAgeGroup,
  resolveTeamSeasonLabelParts,
  type TeamSeasonLabelInput,
} from './seasonLifecycle';

/** Kompaktes Chronik-Label: „U11 · 2025/26“. */
export function formatFeedSeasonBadge(input: TeamSeasonLabelInput): string {
  return formatTeamSeasonCompactSwitcherLabel(input);
}

/** Trenner-Text ohne Status-Suffix. */
export function formatFeedSeasonDividerLabel(input: TeamSeasonLabelInput): string {
  const parts = resolveTeamSeasonLabelParts(input);
  const age =
    (input.ageGroup ?? '').trim() ||
    resolveCurrentAgeGroup({
      ageGroup: input.ageGroup,
      teamName: input.teamName,
      displayName: input.displayName,
    }) ||
    parts.teamLine.match(/\bU\d{1,2}\b/i)?.[0] ||
    '';
  const season = (parts.seasonLine || '').trim();
  if (age && season && season !== '—') return `${age} · ${season}`;
  if (age) return age;
  if (season && season !== '—') return season;
  return parts.full || 'Saison';
}

/**
 * Teamzeile für einen Feedpost aus DESSEN team_season-Metadaten.
 * Niemals die aktive Saison „überstempeln“.
 * Beispiel: „U11 SPG Rohrbach“ / „U12 SPG Rohrbach“.
 */
export function formatFeedPostTeamLabel(input: TeamSeasonLabelInput): string {
  const parts = resolveTeamSeasonLabelParts(input);
  const age =
    (input.ageGroup ?? '').trim() ||
    resolveCurrentAgeGroup({
      ageGroup: input.ageGroup,
      teamName: input.teamName,
      displayName: input.displayName,
    }) ||
    '';
  const teamLine = (parts.teamLine || '').trim();
  if (age && teamLine) {
    if (new RegExp(`\\b${age}\\b`, 'i').test(teamLine)) return teamLine;
    const withoutAge = teamLine.replace(/\bU\d{1,2}\b/gi, '').replace(/\s+/g, ' ').trim();
    if (withoutAge) return `${age} ${withoutAge}`.replace(/\s+/g, ' ').trim();
    return `${age} ${teamLine}`.replace(/\s+/g, ' ').trim();
  }
  if (teamLine) return teamLine;
  if (age) return age;
  return 'Team';
}

export type FeedSeasonDisplayMeta = {
  teamSeasonId: string;
  teamLabel: string;
  seasonBadge: string;
};

export function buildFeedSeasonDisplayMeta(
  teamSeasonId: string,
  input: TeamSeasonLabelInput,
): FeedSeasonDisplayMeta {
  return {
    teamSeasonId,
    teamLabel: formatFeedPostTeamLabel(input),
    seasonBadge: formatFeedSeasonDividerLabel(input),
  };
}
