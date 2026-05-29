import { uploadStaffProfilePhoto, type ProfilePhotoUploadResult } from "./profileCutoutUpload";

/** @deprecated Nutze uploadStaffProfilePhoto — behält Kompatibilität für einfache Avatar-Only-Calls. */
export async function uploadStaffAvatar(
  teamSeasonId: string,
  userId: string,
  file: File,
): Promise<{ publicUrl: string | null; error: string | null }> {
  const result = await uploadStaffProfilePhoto(teamSeasonId, userId, file);
  return { publicUrl: result.avatarUrl, error: result.error };
}

export { uploadStaffProfilePhoto, type ProfilePhotoUploadResult };
