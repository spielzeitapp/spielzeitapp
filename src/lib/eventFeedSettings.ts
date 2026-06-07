import { supabase } from './supabaseClient';
import { uploadStorageObject } from './storageUpload';
import type {
  EventFeedPosterSource,
  EventFeedPostOffset,
  EventFeedSettingsRow,
  UpsertEventFeedSettingsInput,
} from '../types/eventFeedSettings';

const TEAM_FEED_BUCKET = 'team-feed';
const POSTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_POSTER_BYTES = 10 * 1024 * 1024;

export function parseEventFeedPostOffsets(raw: unknown): EventFeedPostOffset[] {
  if (!Array.isArray(raw)) return [];
  const out: EventFeedPostOffset[] = [];
  for (const v of raw) {
    if (v === 'immediate' || String(v).trim().toLowerCase() === 'immediate') {
      out.push('immediate');
      continue;
    }
    const n = Number(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function parsePostOffsets(raw: unknown): EventFeedPostOffset[] {
  return parseEventFeedPostOffsets(raw);
}

function mapRow(raw: Record<string, unknown>): EventFeedSettingsRow {
  const posterSource = String(raw.poster_source ?? 'custom').trim().toLowerCase();
  const postMode = String(raw.post_mode ?? 'manual_only').trim().toLowerCase();
  return {
    id: String(raw.id ?? ''),
    event_id: String(raw.event_id ?? ''),
    team_season_id: String(raw.team_season_id ?? ''),
    poster_url: typeof raw.poster_url === 'string' ? raw.poster_url : null,
    poster_storage_path: typeof raw.poster_storage_path === 'string' ? raw.poster_storage_path : null,
    poster_source:
      posterSource === 'generated' || posterSource === 'none'
        ? (posterSource as EventFeedPosterSource)
        : 'custom',
    auto_post_enabled: Boolean(raw.auto_post_enabled),
    post_offsets_days: parsePostOffsets(raw.post_offsets_days),
    post_mode: postMode === 'auto' ? 'auto' : 'manual_only',
    prefer_custom_poster: raw.prefer_custom_poster !== false,
    caption_override: typeof raw.caption_override === 'string' ? raw.caption_override : null,
    created_by: typeof raw.created_by === 'string' ? raw.created_by : null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
}

function sanitizeSegment(raw: string): string | null {
  const s = raw.trim().replace(/^\/+|\/+$/g, '');
  if (!s || s.includes('/') || /\s/.test(s)) return null;
  return s;
}

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export function buildEventPosterStoragePath(teamSeasonId: string, eventId: string, ext: string): string | null {
  const ts = sanitizeSegment(teamSeasonId);
  const ev = sanitizeSegment(eventId);
  if (!ts || !ev) return null;
  return `posters/${ts}/${ev}/${crypto.randomUUID()}.${ext}`;
}

export async function loadEventFeedSettings(eventId: string): Promise<EventFeedSettingsRow | null> {
  const id = eventId.trim();
  if (!id) return null;
  const { data, error } = await supabase.from('event_feed_settings').select('*').eq('event_id', id).maybeSingle();
  if (error) {
    console.warn('[eventFeedSettings] load', error.message);
    return null;
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function upsertEventFeedSettings(
  input: UpsertEventFeedSettingsInput,
): Promise<{ data: EventFeedSettingsRow | null; error: string | null }> {
  const eventId = input.event_id.trim();
  const teamSeasonId = input.team_season_id.trim();
  if (!eventId || !teamSeasonId) return { data: null, error: 'Event oder Team fehlt.' };

  const payload: Record<string, unknown> = {
    event_id: eventId,
    team_season_id: teamSeasonId,
  };
  if (input.poster_url !== undefined) payload.poster_url = input.poster_url;
  if (input.poster_storage_path !== undefined) payload.poster_storage_path = input.poster_storage_path;
  if (input.poster_source !== undefined) payload.poster_source = input.poster_source;
  if (input.auto_post_enabled !== undefined) payload.auto_post_enabled = input.auto_post_enabled;
  if (input.post_offsets_days !== undefined) payload.post_offsets_days = input.post_offsets_days;
  if (input.post_mode !== undefined) payload.post_mode = input.post_mode;
  if (input.prefer_custom_poster !== undefined) payload.prefer_custom_poster = input.prefer_custom_poster;
  if (input.caption_override !== undefined) payload.caption_override = input.caption_override;
  if (input.created_by !== undefined) payload.created_by = input.created_by;

  const { data, error } = await supabase
    .from('event_feed_settings')
    .upsert(payload, { onConflict: 'event_id' })
    .select('*')
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Speichern fehlgeschlagen.' };
  return { data: mapRow(data as Record<string, unknown>), error: null };
}

export async function removeEventPosterStorage(storagePath: string | null | undefined): Promise<void> {
  const path = storagePath?.trim();
  if (!path) return;
  await supabase.storage.from(TEAM_FEED_BUCKET).remove([path]).catch(() => undefined);
}

export async function uploadEventPoster(params: {
  eventId: string;
  teamSeasonId: string;
  file: File;
  userId: string | null;
  previousStoragePath?: string | null;
}): Promise<{ storagePath: string | null; error: string | null }> {
  const file = params.file;
  if (!POSTER_IMAGE_TYPES.has(file.type)) {
    return { storagePath: null, error: 'Nur JPG, PNG oder WebP.' };
  }
  if (file.size > MAX_POSTER_BYTES) {
    return { storagePath: null, error: 'Poster maximal 10 MB.' };
  }

  const objectPath = buildEventPosterStoragePath(params.teamSeasonId, params.eventId, extForMime(file.type));
  if (!objectPath) return { storagePath: null, error: 'Ungültiger Upload-Pfad.' };

  const { error: upErr } = await uploadStorageObject(TEAM_FEED_BUCKET, objectPath, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '3600',
  });
  if (upErr) return { storagePath: null, error: upErr.message };

  const { data, error } = await upsertEventFeedSettings({
    event_id: params.eventId,
    team_season_id: params.teamSeasonId,
    poster_url: objectPath,
    poster_storage_path: objectPath,
    poster_source: 'custom',
    created_by: params.userId,
  });
  if (error) {
    await removeEventPosterStorage(objectPath);
    return { storagePath: null, error };
  }
  if (params.previousStoragePath && params.previousStoragePath !== objectPath) {
    await removeEventPosterStorage(params.previousStoragePath);
  }
  return { storagePath: data?.poster_storage_path ?? objectPath, error: null };
}

export async function clearEventPoster(params: {
  eventId: string;
  teamSeasonId: string;
  storagePath?: string | null;
}): Promise<{ error: string | null }> {
  if (params.storagePath) {
    await removeEventPosterStorage(params.storagePath);
  }
  const { error } = await upsertEventFeedSettings({
    event_id: params.eventId,
    team_season_id: params.teamSeasonId,
    poster_url: null,
    poster_storage_path: null,
    poster_source: 'none',
  });
  return { error };
}
