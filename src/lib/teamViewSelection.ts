import { isSeasonActive } from './seasonLifecycle';

export type TeamViewFilter = 'all' | string[] | null;

export const isTeamSeasonId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function restoreTeamViewFilter(value: unknown): TeamViewFilter {
  if (value === 'all') return 'all';
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.filter(isTeamSeasonId))].slice(0, 30);
  return ids.length ? ids : null;
}

/** External favorites are read scopes only; the database still enforces access. */
export function resolveTeamViewSeasonIds(
  seasons: readonly { id: string; status?: string | null }[],
  filter: TeamViewFilter,
  singleId: string | null,
): string[] {
  if (filter === null) return singleId && (seasons.some((season) => season.id === singleId) || isTeamSeasonId(singleId)) ? [singleId] : [];
  const activeIds = [...new Set(seasons.filter((season) => isSeasonActive(season.status)).map((season) => season.id))];
  return filter === 'all' ? activeIds : [...new Set(filter)].filter(id =>
    activeIds.includes(id) || (!seasons.some(season => season.id === id) && isTeamSeasonId(id)));
}
