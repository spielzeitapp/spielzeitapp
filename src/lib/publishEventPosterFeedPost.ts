import { supabase } from './supabaseClient';
import type { EventRow } from '../hooks/useEvents';
import type { EventFeedPostOffset, EventFeedSettingsRow } from '../types/eventFeedSettings';
import { formatDateTimeMediumDeVienna } from './notifications/format';

export function eventPosterManualDedupeKey(eventId: string): string {
  return `event_feed:${eventId.trim()}:manual`;
}

export function eventPosterAutoDedupeKey(eventId: string, offset: EventFeedPostOffset): string {
  const id = eventId.trim();
  if (offset === 'immediate') return `event_feed:${id}:immediate`;
  return `event_feed:${id}:offset_${offset}`;
}

function eventPosterTitle(event: Pick<EventRow, 'kind' | 'type' | 'opponent' | 'notes'>): string {
  const opponent = (event.opponent ?? '').trim();
  if (event.kind === 'match') {
    return opponent ? `Spiel · ${opponent}` : 'Spiel';
  }
  if (event.kind === 'training' || event.type === 'training') return 'Training';
  if (event.kind === 'tournament') return opponent || 'Turnier';
  const notesHead = (event.notes ?? '').split(' · ')[0]?.trim();
  return notesHead || opponent || 'Termin';
}

export function buildEventPosterFeedCaption(
  event: Pick<EventRow, 'kind' | 'type' | 'opponent' | 'starts_at' | 'location' | 'notes'>,
  captionOverride?: string | null,
): string {
  const override = captionOverride?.trim();
  if (override) return override;
  const lines = [eventPosterTitle(event), formatDateTimeMediumDeVienna(event.starts_at)];
  const loc = (event.location ?? '').trim();
  if (loc) lines.push(loc);
  return lines.filter(Boolean).join('\n');
}

export type PublishEventPosterResult =
  | { ok: true }
  | { ok: false; reason: 'no_poster' | 'already_posted' | 'missing_team' | string };

async function resolveTeamId(teamSeasonId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();
  if (error || !data?.team_id) return null;
  return String(data.team_id);
}

export async function isEventPosterManualFeedPublished(eventId: string): Promise<boolean> {
  const dedupeKey = eventPosterManualDedupeKey(eventId);
  const { data, error } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (error) {
    console.warn('[publishEventPosterFeedPost] dedupe check', error.message);
    return false;
  }
  return Boolean(data?.id);
}

export async function publishEventPosterToFeed(params: {
  event: EventRow;
  settings: EventFeedSettingsRow;
  userId: string | null;
}): Promise<PublishEventPosterResult> {
  const mediaPath = (params.settings.poster_storage_path ?? params.settings.poster_url ?? '').trim();
  if (!mediaPath) return { ok: false, reason: 'no_poster' };

  const dedupeKey = eventPosterManualDedupeKey(params.event.id);
  const already = await isEventPosterManualFeedPublished(params.event.id);
  if (already) return { ok: false, reason: 'already_posted' };

  const teamId = await resolveTeamId(params.event.team_season_id);
  if (!teamId) return { ok: false, reason: 'missing_team' };

  const caption = buildEventPosterFeedCaption(params.event, params.settings.caption_override);
  const { error } = await supabase.from('team_feed_posts').insert({
    team_season_id: params.event.team_season_id,
    team_id: teamId,
    event_id: params.event.id,
    post_kind: 'event_poster_manual',
    caption,
    payload: {
      storage_path: mediaPath,
      event_id: params.event.id,
      prefer_custom_poster: params.settings.prefer_custom_poster,
    },
    dedupe_key: dedupeKey,
    media_type: 'image',
    media_url: mediaPath,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: params.userId,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'already_posted' };
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}
