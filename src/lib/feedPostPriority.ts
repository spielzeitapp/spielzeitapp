import type { EventRow } from '../hooks/useEvents';
import { parseMatchdayPayload, type ClassifiedFeedPost, type TeamFeedPostDbRow } from './matchdayFeedTypes';
import {
  isNextViennaCalendarDay,
  isSameViennaCalendarDay,
  viennaCalendarDaysUntil,
} from './viennaTime';

export const FEED_POST_PRIORITY = {
  live_match: 100,
  matchday_today: 90,
  lineup_auto: 85,
  matchday_tomorrow: 80,
  next_match: 70,
  trainer_post: 50,
  video_post: 50,
  image_post: 50,
  result_post: 40,
  default: 45,
} as const;

export type FeedPostPriorityKey = keyof typeof FEED_POST_PRIORITY;

function kickoffIsoFromRow(row: TeamFeedPostDbRow): string | null {
  const raw = row.payload;
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const iso = p.kickoff_iso ?? p.starts_at;
  return typeof iso === 'string' && iso.trim() ? iso : null;
}

function matchdayPriorityFromKickoff(kickoffIso: string, now: Date): number {
  const kick = new Date(kickoffIso);
  if (Number.isNaN(kick.getTime())) return FEED_POST_PRIORITY.default;
  const days = viennaCalendarDaysUntil(kick, now);
  if (days === 0) return FEED_POST_PRIORITY.matchday_today;
  if (days === 1) return FEED_POST_PRIORITY.matchday_tomorrow;
  return FEED_POST_PRIORITY.default;
}

/** Veraltete matchday_*_auto-Posts (Kickoff nicht heute/morgen in Vienna) ausblenden. */
export function isMatchdayAutoPostActiveForViennaDay(row: TeamFeedPostDbRow, now: Date = new Date()): boolean {
  const pk = (row.post_kind ?? '').toLowerCase().trim();
  const kick = kickoffIsoFromRow(row);
  if (!kick) {
    if (pk === 'matchday_today_auto' || pk === 'matchday_tomorrow_auto') return false;
    return true;
  }
  const kickDate = new Date(kick);
  if (Number.isNaN(kickDate.getTime())) return false;

  const days = viennaCalendarDaysUntil(kickDate, now);
  if (pk === 'matchday_today_auto') return days === 0;
  if (pk === 'matchday_tomorrow_auto') return days === 1;

  if (pk === 'matchday_auto' || (row.media_type ?? '').toLowerCase() === 'matchday') {
    const raw = row.payload as Record<string, unknown> | null;
    const timing = raw?.matchday_timing;
    if (timing === 'today') return days === 0;
    if (timing === 'tomorrow') return days === 1;
    if (days === 0 || days === 1) return true;
    return false;
  }

  return true;
}

/**
 * Priorität für Feed-Sortierung (clientseitig, ohne DB-Migration).
 */
export function getFeedPostPriority(
  row: TeamFeedPostDbRow,
  eventStatusById: Map<string, string>,
  now: Date = new Date(),
): number {
  const pk = (row.post_kind ?? '').toLowerCase().trim();
  const mt = (row.media_type ?? '').toLowerCase().trim();
  const eventId = row.event_id?.trim() ?? '';

  if (mt === 'live' || pk === 'live_auto') {
    return FEED_POST_PRIORITY.live_match;
  }

  if (eventId && eventStatusById.get(eventId) === 'live') {
    return FEED_POST_PRIORITY.live_match;
  }

  if (pk === 'matchday_today_auto') {
    const kick = kickoffIsoFromRow(row);
    if (kick && !isSameViennaCalendarDay(new Date(kick), now)) return FEED_POST_PRIORITY.default;
    return FEED_POST_PRIORITY.matchday_today;
  }

  if (pk === 'lineup_auto' || mt === 'lineup') {
    return FEED_POST_PRIORITY.lineup_auto;
  }

  if (pk === 'matchday_tomorrow_auto') {
    const kick = kickoffIsoFromRow(row);
    if (kick && !isNextViennaCalendarDay(new Date(kick), now)) return FEED_POST_PRIORITY.default;
    return FEED_POST_PRIORITY.matchday_tomorrow;
  }

  if (mt === 'next_match' || pk === 'next_match_auto') {
    return FEED_POST_PRIORITY.next_match;
  }

  if (mt === 'result' || pk === 'result_auto') {
    return FEED_POST_PRIORITY.result_post;
  }

  if (mt === 'video' && row.media_url) {
    return FEED_POST_PRIORITY.video_post;
  }

  if (mt === 'image' && row.media_url) {
    return FEED_POST_PRIORITY.image_post;
  }

  if (pk === 'trainer_video' || pk === 'trainer_image') {
    return FEED_POST_PRIORITY.trainer_post;
  }

  if (pk === 'matchday_auto' || (mt === 'matchday' && parseMatchdayPayload(row.payload))) {
    const raw = row.payload as Record<string, unknown> | null;
    if (raw?.matchday_timing === 'today') return FEED_POST_PRIORITY.matchday_today;
    if (raw?.matchday_timing === 'tomorrow') return FEED_POST_PRIORITY.matchday_tomorrow;
    const kick = kickoffIsoFromRow(row);
    if (kick) return matchdayPriorityFromKickoff(kick, now);
    const cap = (row.caption ?? '').toLowerCase();
    if (cap.includes('heute')) return FEED_POST_PRIORITY.matchday_today;
    if (cap.includes('morgen')) return FEED_POST_PRIORITY.matchday_tomorrow;
    return FEED_POST_PRIORITY.matchday_tomorrow;
  }

  return FEED_POST_PRIORITY.default;
}

function classifiedPostRow(item: ClassifiedFeedPost): TeamFeedPostDbRow {
  return item.post as TeamFeedPostDbRow;
}

/** Sortierzeit: created_at, sonst updated_at, sonst 0. */
function feedPostSortTimestamp(row: TeamFeedPostDbRow): number {
  const created = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
  if (Number.isFinite(created)) return created;
  const updated = row.updated_at ? new Date(row.updated_at).getTime() : Number.NaN;
  if (Number.isFinite(updated)) return updated;
  return 0;
}

function feedPostUpdatedTimestamp(row: TeamFeedPostDbRow): number {
  const updated = row.updated_at ? new Date(row.updated_at).getTime() : Number.NaN;
  return Number.isFinite(updated) ? updated : 0;
}

/** Home-Feed: neueste Nachricht zuerst; priority nur bei gleichem Zeitstempel. */
export function sortClassifiedFeedPosts(
  items: ClassifiedFeedPost[],
  eventStatusById: Map<string, string>,
  now: Date = new Date(),
): ClassifiedFeedPost[] {
  return [...items].sort((a, b) => {
    const ta = feedPostSortTimestamp(classifiedPostRow(a));
    const tb = feedPostSortTimestamp(classifiedPostRow(b));
    if (tb !== ta) return tb - ta;
    const pa = getFeedPostPriority(classifiedPostRow(a), eventStatusById, now);
    const pb = getFeedPostPriority(classifiedPostRow(b), eventStatusById, now);
    if (pb !== pa) return pb - pa;
    return feedPostUpdatedTimestamp(classifiedPostRow(b)) - feedPostUpdatedTimestamp(classifiedPostRow(a));
  });
}

/** @alias sortClassifiedFeedPosts */
export const sortTeamFeedPosts = sortClassifiedFeedPosts;

export function buildEventStatusMap(events: Pick<EventRow, 'id' | 'status'>[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) {
    m.set(e.id, (e.status ?? 'upcoming').toLowerCase());
  }
  return m;
}
