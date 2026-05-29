import { supabase } from "./supabaseClient";

const PLAYER_AVATAR_BUCKET = "player-avatars";
const STAFF_PHOTO_BUCKET = "team-photos";

export type ProfilePhotoUploadResult = {
  avatarUrl: string | null;
  cutoutUrl: string | null;
  error: string | null;
};

function isPngOrWebpMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return m === "image/png" || m === "image/webp";
}

function isPngOrWebpName(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith(".png") || n.endsWith(".webp");
}

/** Prüft Stichproben auf Alpha < 250 (transparente PNG/WebP). */
export async function fileHasMeaningfulAlpha(file: File): Promise<boolean> {
  if (typeof createImageBitmap !== "function") {
    return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
  }
  try {
    const bitmap = await createImageBitmap(file);
    const w = Math.min(bitmap.width, 96);
    const h = Math.min(bitmap.height, 96);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return file.type === "image/png";
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
  }
}

/** PNG/WebP mit erkennbarer Transparenz → zusätzlich als Cutout speichern. */
export async function shouldStoreProfileCutout(file: File): Promise<boolean> {
  const mime = (file.type ?? "").toLowerCase();
  if (!isPngOrWebpMime(mime) && !isPngOrWebpName(file.name)) return false;
  return fileHasMeaningfulAlpha(file);
}

function avatarExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function cutoutExtension(file: File): string {
  if (file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp")) return "webp";
  return "png";
}

async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
): Promise<{ publicUrl: string | null; error: string | null }> {
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) {
    return { publicUrl: null, error: uploadError.message };
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = (data?.publicUrl ?? "").trim() || null;
  return { publicUrl, error: publicUrl ? null : "Öffentliche URL konnte nicht erzeugt werden." };
}

export async function uploadPlayerProfilePhoto(
  teamSeasonId: string,
  playerId: string,
  file: File,
): Promise<ProfilePhotoUploadResult> {
  const ext = avatarExtension(file);
  const avatarPath = `${teamSeasonId}/${playerId}.${ext}`;
  const { publicUrl: avatarUrl, error } = await uploadToBucket(PLAYER_AVATAR_BUCKET, avatarPath, file);
  if (error) {
    return { avatarUrl: null, cutoutUrl: null, error };
  }

  let cutoutUrl: string | null = null;
  if (await shouldStoreProfileCutout(file)) {
    const cutoutPath = `${teamSeasonId}/cutouts/${playerId}.${cutoutExtension(file)}`;
    const cutout = await uploadToBucket(PLAYER_AVATAR_BUCKET, cutoutPath, file);
    if (!cutout.error) {
      cutoutUrl = cutout.publicUrl;
    }
  }

  return { avatarUrl, cutoutUrl, error: null };
}

export async function uploadStaffProfilePhoto(
  teamSeasonId: string,
  userId: string,
  file: File,
): Promise<ProfilePhotoUploadResult> {
  const ext = avatarExtension(file);
  const avatarPath = `${teamSeasonId}/staff/${userId}.${ext}`;
  const { publicUrl: avatarUrl, error } = await uploadToBucket(STAFF_PHOTO_BUCKET, avatarPath, file);
  if (error) {
    return { avatarUrl: null, cutoutUrl: null, error };
  }

  let cutoutUrl: string | null = null;
  if (await shouldStoreProfileCutout(file)) {
    const cutoutPath = `${teamSeasonId}/cutouts/${userId}.${cutoutExtension(file)}`;
    const cutout = await uploadToBucket(STAFF_PHOTO_BUCKET, cutoutPath, file);
    if (!cutout.error) {
      cutoutUrl = cutout.publicUrl;
    }
  }

  return { avatarUrl, cutoutUrl, error: null };
}
