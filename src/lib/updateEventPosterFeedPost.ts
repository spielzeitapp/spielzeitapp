import { supabase } from './supabaseClient';
import { removeEventPosterStorage, uploadEventPoster } from './eventFeedSettings';
import type { TeamFeedPostDbRow } from './matchdayFeedTypes';

export async function updateEventPosterFeedPost(params: {
  post: TeamFeedPostDbRow;
  caption: string;
  file?: File | null;
}): Promise<{ error: string | null }> {
  const eventId = params.post.event_id?.trim();
  if (!eventId) return { error: 'Dem Beitrag ist kein Termin zugeordnet.' };

  const previousPath = params.post.media_url?.trim() || null;
  let mediaPath = previousPath;

  if (params.file) {
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
  }

  const { data, error } = await supabase.rpc('update_event_poster_feed_post', {
    p_post_id: params.post.id,
    p_caption: params.caption.trim(),
    p_media_url: mediaPath,
  });
  if (error) return { error: error.message };
  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (result.ok !== true) return { error: result.error ?? 'Der Beitrag konnte nicht geändert werden.' };

  if (params.file && previousPath && previousPath !== mediaPath) {
    await removeEventPosterStorage(previousPath);
  }
  return { error: null };
}
