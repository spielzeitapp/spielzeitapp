import {
  formatTeamSeasonCompactSwitcherLabel,
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
    parts.teamLine.match(/\bU\d{1,2}\b/i)?.[0] ||
    '';
  const season = (parts.seasonLine || '').trim();
  if (age && season && season !== '—') return `${age} · ${season}`;
  if (age) return age;
  if (season && season !== '—') return season;
  return parts.full || 'Saison';
}
