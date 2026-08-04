/**
 * Spielplan-Filter für /app/spielplan und gefilterte Saisonplan-PDFs.
 * Source of Truth: events (is_home, venue_id, kind).
 */
import type { SeasonPlanEventKind, SeasonPlanRow } from './seasonPlanPdf';
import { supabase } from './supabaseClient';
import { safeText } from './safeText';

export type ScheduleHomeAwayFilter = 'all' | 'home' | 'away';

/** Architektur vorbereitet; UI optional. */
export type ScheduleEventTypeFilter = 'all' | SeasonPlanEventKind;

export type SchedulePlanFilterState = {
  homeAway: ScheduleHomeAwayFilter;
  venueId: string | null;
  eventType: ScheduleEventTypeFilter;
};

export const DEFAULT_SCHEDULE_PLAN_FILTER: SchedulePlanFilterState = {
  homeAway: 'all',
  venueId: null,
  eventType: 'all',
};

export type ScheduleFilterableRow = Pick<SeasonPlanRow, 'kind' | 'is_home' | 'venue_id'>;

export type ScheduleVenueOption = {
  id: string;
  name: string;
  isHome: boolean;
  count: number;
};

export function parseScheduleHomeAway(raw: string | null | undefined): ScheduleHomeAwayFilter {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'home' || s === 'heim') return 'home';
  if (s === 'away' || s === 'auswaerts' || s === 'auswärts') return 'away';
  return 'all';
}

export function parseScheduleEventType(raw: string | null | undefined): ScheduleEventTypeFilter {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'championship' || s === 'meisterschaft') return 'championship';
  if (s === 'friendly' || s === 'vorbereitung') return 'friendly';
  if (s === 'tournament' || s === 'turnier') return 'tournament';
  if (s === 'training') return 'training';
  return 'all';
}

/**
 * Heim/Auswärts:
 * - home/away: nur Meisterschaft + Vorbereitung mit is_home; Turniere ausgeblendet
 * - all: Turniere bleiben sichtbar
 * Venue:
 * - primär event.venue_id === selected
 * - ohne venue_id bei aktivem Venue-Filter: kein Match (kein unsicherer Location-Fallback)
 */
export function matchesSchedulePlanFilter(
  row: ScheduleFilterableRow,
  filter: SchedulePlanFilterState,
): boolean {
  if (filter.eventType !== 'all' && row.kind !== filter.eventType) return false;

  if (filter.homeAway === 'home') {
    if (row.kind === 'tournament') return false;
    if (row.is_home !== true) return false;
  } else if (filter.homeAway === 'away') {
    if (row.kind === 'tournament') return false;
    if (row.is_home !== false) return false;
  }

  if (filter.venueId) {
    const vid = String(row.venue_id ?? '').trim();
    if (!vid || vid !== filter.venueId) return false;
  }

  return true;
}

export function filterSchedulePlanRows<T extends ScheduleFilterableRow>(
  rows: T[],
  filter: SchedulePlanFilterState,
): T[] {
  return rows.filter((r) => matchesSchedulePlanFilter(r, filter));
}

export function isScheduleFilterActive(filter: SchedulePlanFilterState): boolean {
  return (
    filter.homeAway !== 'all' ||
    Boolean(filter.venueId) ||
    filter.eventType !== 'all'
  );
}

export function countScheduleHomeAway(
  rows: ScheduleFilterableRow[],
): { all: number; home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const r of rows) {
    if (r.kind === 'tournament') continue;
    if (r.is_home === true) home += 1;
    else if (r.is_home === false) away += 1;
  }
  return { all: rows.length, home, away };
}

/** Venue-IDs, die in den (ungefilterten) Saisonplan-Zeilen vorkommen. */
export function collectUsedVenueIds(rows: Array<{ venue_id?: string | null }>): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const id = String(r.venue_id ?? '').trim();
    if (id) set.add(id);
  }
  return [...set];
}

export async function loadScheduleVenueOptions(opts: {
  venueIds: string[];
  rows: Array<{ venue_id?: string | null }>;
}): Promise<{ options: ScheduleVenueOption[]; error: string | null }> {
  const ids = opts.venueIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return { options: [], error: null };

  const counts = new Map<string, number>();
  for (const r of opts.rows) {
    const id = String(r.venue_id ?? '').trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const { data, error } = await supabase
    .from('venues')
    .select('id, name, is_home')
    .in('id', ids);

  if (error) return { options: [], error: error.message };

  const options: ScheduleVenueOption[] = (data ?? []).map((v) => {
    const id = String(v.id ?? '').trim();
    return {
      id,
      name: safeText(v.name) || 'Spielort',
      isHome: v.is_home === true,
      count: counts.get(id) ?? 0,
    };
  });

  options.sort((a, b) => {
    if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });

  return { options, error: null };
}

export type SeasonPlanPdfTitleKind = 'saison' | 'heim' | 'auswaerts';

export function resolveSeasonPlanPdfTitleKind(
  homeAway: ScheduleHomeAwayFilter,
): SeasonPlanPdfTitleKind {
  if (homeAway === 'home') return 'heim';
  if (homeAway === 'away') return 'auswaerts';
  return 'saison';
}

export function seasonPlanPdfTitleKindLabel(kind: SeasonPlanPdfTitleKind): string {
  if (kind === 'heim') return 'HEIMSPIELPLAN';
  if (kind === 'auswaerts') return 'AUSWÄRTSSPIELPLAN';
  return 'SAISONPLAN';
}

export function seasonPlanPdfFilenamePrefix(kind: SeasonPlanPdfTitleKind): string {
  if (kind === 'heim') return 'heimspielplan';
  if (kind === 'auswaerts') return 'auswaertsspielplan';
  return 'saisonplan';
}

export function slugifyScheduleToken(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
