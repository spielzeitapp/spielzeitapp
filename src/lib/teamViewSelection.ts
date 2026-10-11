import { isSeasonActive } from './seasonLifecycle';

export type TeamViewFilter = 'all' | string[] | null;

/** The caller supplies only its already authorized session seasons. */
export function resolveTeamViewSeasonIds(
  seasons: readonly { id: string; status?: string | null }[],
  filter: TeamViewFilter,
  singleId: string | null,
): string[] {
  if (filter === null) return singleId && seasons.some((season) => season.id === singleId) ? [singleId] : [];
  const activeIds = [...new Set(seasons.filter((season) => isSeasonActive(season.status)).map((season) => season.id))];
  return filter === 'all' ? activeIds : activeIds.filter((id) => filter.includes(id));
}
