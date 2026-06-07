import { supabase } from './supabaseClient';
import { parseEventFeedPostOffsets } from './eventFeedSettings';
import {
  buildEventPosterFeedCaption,
  eventPosterAutoDedupeKey,
} from './publishEventPosterFeedPost';
import type { EventFeedPostOffset, EventFeedSettingsRow } from '../types/eventFeedSettings';
import { viennaCalendarDaysUntil } from './viennaTime';

export type EnsureEventFeedPostsResult = {
  scanned: number;
  created: number;
  skipped: number;
  errors: string[];
};

type EventRowLite = {
  id: string;
  team_season_id: string;
  kind: string | null;
  type: string | null;
  status: string | null;
  opponent: string | null;
  starts_at: string;
  location: string | null;
  notes: string | null;
};

type SettingsWithEvent = EventFeedSettingsRow & { event: EventRowLite };

function efLog(phase: string, data: Record<string, unknown>): void {
  console.info(`[eventFeedPosts] ${phase}`, data);
}

async function resolveTeamId(teamSeasonId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();
  if (error || !data?.team_id) return null;
  return String(data.team_id);
}

async function isDedupeSuppressed(dedupeKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('team_feed_dedupe_suppressions')
    .select('dedupe_key')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  return Boolean(data?.dedupe_key);
}

async function postExists(dedupeKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

function isUpcomingEvent(ev: EventRowLite, now: Date): boolean {
  const status = (ev.status ?? 'upcoming').toLowerCase();
  if (status === 'canceled' || status === 'cancelled' || status === 'finished') return false;
  const kick = new Date(ev.starts_at);
  if (Number.isNaN(kick.getTime())) return false;
  const days = viennaCalendarDaysUntil(kick, now);
  if (days == null) return false;
  return days >= 0;
}

export function isEventFeedOffsetDue(
  offset: EventFeedPostOffset,
  startsAtIso: string,
  now: Date = new Date(),
): boolean {
  if (offset === 'immediate') return true;
  const kick = new Date(startsAtIso);
  if (Number.isNaN(kick.getTime())) return false;
  const days = viennaCalendarDaysUntil(kick, now);
  if (days == null || days < 0) return false;
  return days === offset;
}

async function insertEventPosterAutoPost(params: {
  event: EventRowLite;
  settings: EventFeedSettingsRow;
  teamId: string;
  offset: EventFeedPostOffset;
  userId: string | null;
}): Promise<{ created: boolean; skipped?: boolean; error?: string }> {
  const mediaPath = (params.settings.poster_storage_path ?? params.settings.poster_url ?? '').trim();
  if (!mediaPath) return { created: false, skipped: true };

  const dedupeKey = eventPosterAutoDedupeKey(params.event.id, params.offset);
  if (dedupeKey.startsWith('event_feed:') && (await isDedupeSuppressed(dedupeKey))) {
    return { created: false, skipped: true };
  }
  if (await postExists(dedupeKey)) {
    return { created: false, skipped: true };
  }

  const caption = buildEventPosterFeedCaption(params.event, params.settings.caption_override);
  const { error: insErr } = await supabase.from('team_feed_posts').insert({
    team_season_id: params.event.team_season_id,
    team_id: params.teamId,
    event_id: params.event.id,
    post_kind: 'event_poster_auto',
    caption,
    payload: {
      storage_path: mediaPath,
      event_id: params.event.id,
      prefer_custom_poster: params.settings.prefer_custom_poster,
      auto_offset: params.offset,
    },
    dedupe_key: dedupeKey,
    media_type: 'image',
    media_url: mediaPath,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: params.userId,
  });

  if (insErr) {
    if (insErr.code === '23505') return { created: false, skipped: true };
    return { created: false, error: insErr.message };
  }

  efLog('created', { eventId: params.event.id, offset: params.offset, dedupeKey });
  return { created: true };
}

function mapSettingsRow(raw: Record<string, unknown>): EventFeedSettingsRow {
  const postMode = String(raw.post_mode ?? 'manual_only').trim().toLowerCase();
  return {
    id: String(raw.id ?? ''),
    event_id: String(raw.event_id ?? ''),
    team_season_id: String(raw.team_season_id ?? ''),
    poster_url: typeof raw.poster_url === 'string' ? raw.poster_url : null,
    poster_storage_path: typeof raw.poster_storage_path === 'string' ? raw.poster_storage_path : null,
    poster_source:
      String(raw.poster_source ?? 'custom').trim().toLowerCase() === 'none'
        ? 'none'
        : String(raw.poster_source ?? 'custom').trim().toLowerCase() === 'generated'
          ? 'generated'
          : 'custom',
    auto_post_enabled: Boolean(raw.auto_post_enabled),
    post_offsets_days: parseEventFeedPostOffsets(raw.post_offsets_days),
    post_mode: postMode === 'auto' ? 'auto' : 'manual_only',
    prefer_custom_poster: raw.prefer_custom_poster !== false,
    caption_override: typeof raw.caption_override === 'string' ? raw.caption_override : null,
    created_by: typeof raw.created_by === 'string' ? raw.created_by : null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
}

/**
 * Idempotent: Event-Poster-Auto-Posts pro Offset (Dedupe event_feed:{eventId}:…).
 * Läuft beim Feed-Laden — keine Uhrzeit-Scheduler.
 */
export async function ensureEventFeedPostsForSeason(
  teamSeasonId: string,
  now: Date = new Date(),
): Promise<EnsureEventFeedPostsResult> {
  const sid = teamSeasonId?.trim();
  const result: EnsureEventFeedPostsResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };
  if (!sid) return result;

  const teamId = await resolveTeamId(sid);
  if (!teamId) {
    result.errors.push('Team zur Saison nicht gefunden.');
    return result;
  }

  const { data: settingsData, error: settingsErr } = await supabase
    .from('event_feed_settings')
    .select(
      'id, event_id, team_season_id, poster_url, poster_storage_path, poster_source, auto_post_enabled, post_offsets_days, post_mode, prefer_custom_poster, caption_override, created_by, created_at, updated_at',
    )
    .eq('team_season_id', sid)
    .eq('auto_post_enabled', true)
    .eq('post_mode', 'auto')
    .not('poster_storage_path', 'is', null);

  if (settingsErr) {
    result.errors.push(settingsErr.message);
    return result;
  }

  const settingsRows = (settingsData ?? []) as Record<string, unknown>[];
  if (settingsRows.length === 0) return result;

  const eventIds = settingsRows.map((r) => String(r.event_id ?? '')).filter(Boolean);
  if (eventIds.length === 0) return result;

  const { data: eventsData, error: eventsErr } = await supabase
    .from('events')
    .select('id, team_season_id, kind, type, status, opponent, starts_at, location, notes')
    .in('id', eventIds)
    .eq('team_season_id', sid)
    .not('status', 'in', '(canceled,finished)');

  if (eventsErr) {
    result.errors.push(eventsErr.message);
    return result;
  }

  const eventById = new Map<string, EventRowLite>();
  for (const ev of (eventsData ?? []) as EventRowLite[]) {
    eventById.set(ev.id, ev);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? null;

  const candidates: SettingsWithEvent[] = [];
  for (const raw of settingsRows) {
    const settings = mapSettingsRow(raw);
    if (settings.post_offsets_days.length === 0) continue;
    const event = eventById.get(settings.event_id);
    if (!event || !event.starts_at) continue;
    if (!isUpcomingEvent(event, now)) continue;
    candidates.push({ ...settings, event });
  }

  result.scanned = candidates.length;

  for (const item of candidates) {
    for (const offset of item.post_offsets_days) {
      if (!isEventFeedOffsetDue(offset, item.event.starts_at, now)) {
        result.skipped += 1;
        continue;
      }

      const insertResult = await insertEventPosterAutoPost({
        event: item.event,
        settings: item,
        teamId,
        offset,
        userId: uid,
      });

      if (insertResult.error) {
        result.errors.push(`${item.event.id}/${String(offset)}: ${insertResult.error}`);
      } else if (insertResult.created) {
        result.created += 1;
      } else {
        result.skipped += 1;
      }
    }
  }

  if (result.created > 0 || result.errors.length > 0) {
    efLog('batch_done', { teamSeasonId: sid, ...result });
  }

  return result;
}
