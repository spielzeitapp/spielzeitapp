import { supabase } from './supabaseClient';
import { removeEventPosterStorage } from './eventFeedSettings';
import type { ResultFeedPostRow } from './matchdayFeedTypes';
import { uploadTeamFeedImage } from './updateEventPosterFeedPost';

type UpdateResultFeedPostMediaParams = {
  post: ResultFeedPostRow;
  file?: File | null;
  remove?: boolean;
};

export async function updateResultFeedPostMedia(
  params: UpdateResultFeedPostMediaParams,
): Promise<{ error: string | null }> {
  const previousPath = params.post.media_url?.trim() || null;
  let nextPath = previousPath;

  if (params.remove) {
    nextPath = null;
  } else if (params.file) {
    const uploaded = await uploadTeamFeedImage(params.post.team_season_id, params.file);
    if (uploaded.error || !uploaded.path) {
      return { error: uploaded.error ?? 'Das Siegerbild konnte nicht hochgeladen werden.' };
    }
    nextPath = uploaded.path;
  } else {
    return { error: 'Bitte zuerst ein Bild auswählen.' };
  }

  const { data, error } = await supabase.rpc('update_result_feed_post_media', {
    p_post_id: params.post.id,
    p_media_url: nextPath,
  });

  if (error) {
    if (nextPath && nextPath !== previousPath) await removeEventPosterStorage(nextPath);
    return { error: error.message };
  }

  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (result.ok !== true) {
    if (nextPath && nextPath !== previousPath) await removeEventPosterStorage(nextPath);
    return { error: result.error ?? 'Das Siegerbild konnte nicht gespeichert werden.' };
  }

  if (previousPath && previousPath !== nextPath) {
    await removeEventPosterStorage(previousPath);
  }

  return { error: null };
}
