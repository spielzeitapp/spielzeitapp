import { supabase } from './supabaseClient';
import { removeEventPosterStorage } from './eventFeedSettings';
import { uploadTeamFeedImage } from './updateEventPosterFeedPost';

export type AutoFeedPostMediaRow = {
  id: string;
  team_season_id: string;
  media_url?: string | null;
};

type UpdateAutoFeedPostMediaParams = {
  post: AutoFeedPostMediaRow;
  file?: File | null;
  remove?: boolean;
};

export async function updateAutoFeedPostMedia(
  params: UpdateAutoFeedPostMediaParams,
): Promise<{ error: string | null }> {
  const previousPath = params.post.media_url?.trim() || null;
  let nextPath = previousPath;

  if (params.remove) {
    nextPath = null;
  } else if (params.file) {
    const uploaded = await uploadTeamFeedImage(params.post.team_season_id, params.file);
    if (uploaded.error || !uploaded.path) {
      return { error: uploaded.error ?? 'Das Bild konnte nicht hochgeladen werden.' };
    }
    nextPath = uploaded.path;
  } else {
    return { error: 'Bitte zuerst ein Bild auswählen.' };
  }

  const { data, error } = await supabase.rpc('update_auto_feed_post_media', {
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
    return { error: result.error ?? 'Das Bild konnte nicht gespeichert werden.' };
  }

  if (previousPath && previousPath !== nextPath) {
    await removeEventPosterStorage(previousPath);
  }

  return { error: null };
}
