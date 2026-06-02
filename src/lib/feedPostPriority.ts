import type { EventRow } from '../hooks/useEvents';
import { parseMatchdayPayload, type ClassifiedFeedPost, type TeamFeedPostDbRow } from './matchdayFeedTypes';
import {
  getDateTimePartsInTimeZone,
  isNextViennaCalendarDay,
  isSameViennaCalendarDay,
  VIENNA_TZ,
  zonedWallTimeToUtcMillis,
} from './viennaTime';

export const FEED_POST_PRIORITY = {
  live_match: 100,
  matchday_today: 90,
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
  if (Number.isNaN(kick.getTime())) return FEED_POST_PRIORITY.matchday_tomorrow;
  if (isSameViennaCalendarDay(kick, now)) return FEED_POST_PRIORITY.matchday_today;
  if (isNextViennaCalendarDay(kick, now)) return FEED_POST_PRIORITY.matchday_tomorrow;
  return FEED_POST_PRIORITY.matchday_tomorrow;
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

  if (eventId && eventStatusById.get(eventId) === 'live') {
    return FEED_POST_PRIORITY.live_match;
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

  if (pk === 'matchday_auto' || parseMatchdayPayload(row.payload)) {
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

export function sortClassifiedFeedPosts(
  items: ClassifiedFeedPost[],
  eventStatusById: Map<string, string>,
  now: Date = new Date(),
): ClassifiedFeedPost[] {
  return [...items].sort((a, b) => {
    const pa = getFeedPostPriority(classifiedPostRow(a), eventStatusById, now);
    const pb = getFeedPostPriority(classifiedPostRow(b), eventStatusById, now);
    if (pb !== pa) return pb - pa;
    const ta = new Date(a.post.created_at).getTime();
    const tb = new Date(b.post.created_at).getTime();
    return tb - ta;
  });
}

/** Kalendertage zwischen now und eventStart in Europe/Vienna (0 = heute). */
export function viennaCalendarDaysUntil(eventStart: Date, now: Date): number | null {
  const pNow = getDateTimePartsInTimeZone(now, VIENNA_TZ);
  const pEv = getDateTimePartsInTimeZone(eventStart, VIENNA_TZ);
  if (!pNow || !pEv) return null;
  const noonNow = zonedWallTimeToUtcMillis(
    { year: pNow.year, month: pNow.month, day: pNow.day, hour: 12, minute: 0 },
    VIENNA_TZ,
  );
  const noonEv = zonedWallTimeToUtcMillis(
    { year: pEv.year, month: pEv.month, day: pEv.day, hour: 12, minute: 0 },
    VIENNA_TZ,
  );
  return Math.round((noonEv - noonNow) / 86_400_000);
}

export function buildEventStatusMap(events: Pick<EventRow, 'id' | 'status'>[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) {
    m.set(e.id, (e.status ?? 'upcoming').toLowerCase());
  }
  return m;
}
