import { supabase } from './supabaseClient';
import { removeEventPosterStorage, uploadEventPoster } from './eventFeedSettings';
import type { TeamFeedPostDbRow } from './matchdayFeedTypes';
import { optimizeFeedPosterFile } from './feedPosterImage';
import { uploadStorageObject } from './storageUpload';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function imageExtension(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadTeamFeedImage(teamSeasonId: string, original: File): Promise<{ path: string | null; error: string | null }> {
  if (!IMAGE_TYPES.has(original.type)) return { path: null, error: 'Nur JPG, PNG oder WebP.' };
  if (original.size > MAX_IMAGE_BYTES) return { path: null, error: 'Bild maximal 10 MB.' };
  const season = teamSeasonId.trim().replace(/^\/+|\/+$/g, '');
  if (!season || season.includes('/') || /\s/.test(season)) return { path: null, error: 'Ungültige Saison.' };
  const file = await optimizeFeedPosterFile(original);
  const path = `images/${season}/${crypto.randomUUID()}.${imageExtension(file.type)}`;
  const uploaded = await uploadStorageObject('team-feed', path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '604800',
  });
  return uploaded.error ? { path: null, error: uploaded.error.message } : { path, error: null };
}

export async function updateEventPosterFeedPost(params: {
  post: TeamFeedPostDbRow;
  caption: string;
  file?: File | null;
}): Promise<{ error: string | null }> {
  const eventId = params.post.event_id?.trim() || null;
  const previousPath = params.post.media_url?.trim() || null;
  let mediaPath = previousPath;

  if (params.file) {
    if (params.post.post_kind === 'event_poster_manual' && eventId) {
      const { data: authData } = await supabase.auth.getUser();
      const uploaded = await uploadEventPoster({
        eventId,
        teamSeasonId: params.post.team_season_id,
        file: params.file,
        userId: authData.user?.id ?? null,
      });
      if (uploaded.error || !uploaded.storagePath) {
        return { error: uploaded.error ?? 'Das neue Bild konnte nicht hochgeladen werden.' };
      }
      mediaPath = uploaded.storagePath;
    } else {
      const uploaded = await uploadTeamFeedImage(params.post.team_season_id, params.file);
      if (uploaded.error || !uploaded.path) {
        return { error: uploaded.error ?? 'Das neue Bild konnte nicht hochgeladen werden.' };
      }
      mediaPath = uploaded.path;
    }
  }

  const { data, error } = await supabase.rpc('update_event_poster_feed_post', {
    p_post_id: params.post.id,
    p_caption: params.caption.trim(),
    p_media_url: mediaPath,
  });
  if (error) {
    if (params.file && mediaPath && mediaPath !== previousPath) await removeEventPosterStorage(mediaPath);
    return { error: error.message };
  }
  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (result.ok !== true) return { error: result.error ?? 'Der Beitrag konnte nicht geändert werden.' };

  if (params.file && previousPath && previousPath !== mediaPath) {
    await removeEventPosterStorage(previousPath);
  }
  return { error: null };
}
