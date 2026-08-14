/** Persistenz Terminfilter Liste ↔ Kalender (Session). */
export type ScheduleKindFilterId = 'all' | 'match' | 'training' | 'event' | 'tournament';
export type ScheduleTimeFilterId = 'all' | 'upcoming' | 'past';

const KEY = 'sz_termine_filters_v1';

export type ScheduleFilterState = {
  kindFilter: ScheduleKindFilterId;
  timeFilter: ScheduleTimeFilterId;
};

export function readScheduleFilters(fallback: ScheduleFilterState): ScheduleFilterState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ScheduleFilterState>;
    const kind = parsed.kindFilter;
    const time = parsed.timeFilter;
    const kindOk =
      kind === 'all' || kind === 'match' || kind === 'training' || kind === 'event' || kind === 'tournament';
    const timeOk = time === 'all' || time === 'upcoming' || time === 'past';
    return {
      kindFilter: kindOk ? kind : fallback.kindFilter,
      timeFilter: timeOk ? time : fallback.timeFilter,
    };
  } catch {
    return fallback;
  }
}

export function writeScheduleFilters(state: ScheduleFilterState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
