import type { EventRow } from '../hooks/useEvents';
import { isUpcomingRelevant } from '../features/home/homeFeedBuilder';
import { isSameViennaCalendarDay } from '../lib/viennaTime';

/** Unabgeschlossene alte Spiele/Turniere gehören nicht in die Terminvorschau. */
export function isManagerUpcomingEvent(event: EventRow, now: Date): boolean {
  const start = new Date(event.starts_at);
  if (!Number.isFinite(start.getTime())) return false;
  if (!isUpcomingRelevant(event, now)) return false;
  return start.getTime() >= now.getTime() || isSameViennaCalendarDay(start, now);
}
