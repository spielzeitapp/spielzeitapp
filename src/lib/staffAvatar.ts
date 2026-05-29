import { supabase } from "./supabaseClient";

/** Öffentlicher Team-Bucket; RLS erlaubt Coach-Upload unter `{teamSeasonId}/…`. */
const STAFF_AVATAR_BUCKET = "team-photos";

export async function uploadStaffAvatar(
  teamSeasonId: string,
  userId: string,
  file: File,
): Promise<{ publicUrl: string | null; error: string | null }> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const uploadPath = `${teamSeasonId}/staff/${userId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(STAFF_AVATAR_BUCKET)
    .upload(uploadPath, file, { upsert: true, contentType: file.type });
  if (uploadError) {
    return { publicUrl: null, error: uploadError.message };
  }
  const { data } = supabase.storage.from(STAFF_AVATAR_BUCKET).getPublicUrl(uploadPath);
  const publicUrl = (data?.publicUrl ?? "").trim() || null;
  return { publicUrl, error: publicUrl ? null : "Öffentliche URL konnte nicht erzeugt werden." };
}
