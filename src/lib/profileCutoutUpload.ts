import { supabase } from "./supabaseClient";
import { withProfileImageCacheBust } from "./profileHeroImage";
import { uploadStorageObject, type StorageUploadOptions } from "./storageUpload";

const PLAYER_AVATAR_BUCKET = "player-avatars";
const STAFF_PHOTO_BUCKET = "team-photos";

const LOG_PREFIX = "[profileHeroUpload]";

export type ProfilePhotoUploadResult = {
  avatarUrl: string | null;
  cutoutUrl: string | null;
  error: string | null;
};

export function logProfileHeroUpload(step: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.log(LOG_PREFIX, step, detail);
  } else {
    console.log(LOG_PREFIX, step);
  }
}

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
  if (file.type === "image/jpeg" || file.name.toLowerCase().match(/\.jpe?g$/)) return "jpg";
  return "png";
}

function baseUploadOptions(file: File): Pick<StorageUploadOptions, "upsert" | "contentType" | "cacheControl"> {
  return {
    upsert: true,
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
  };
}

/** Spieler-Metadata — kein membership_role. */
function playerUploadOptions(
  file: File,
  teamSeasonId: string,
  playerId: string,
  mediaKind: "avatar" | "hero",
): StorageUploadOptions {
  return {
    ...baseUploadOptions(file),
    debugLabel: "player",
    metadata: {
      entity_type: "player",
      player_id: playerId,
      team_season_id: teamSeasonId,
      media_kind: mediaKind,
    },
  };
}

/** Trainer-Metadata — gleicher Wrapper, kein membership_role. */
function staffUploadOptions(file: File, teamSeasonId: string, userId: string, mediaKind: "avatar" | "hero"): StorageUploadOptions {
  return {
    ...baseUploadOptions(file),
    metadata: {
      entity_type: "staff",
      user_id: userId,
      team_season_id: teamSeasonId,
      media_kind: mediaKind,
    },
  };
}

async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
  options: StorageUploadOptions,
): Promise<{ publicUrl: string | null; error: string | null; storagePath: string }> {
  logProfileHeroUpload("storage upload start", {
    bucket,
    path,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  const { error: uploadError } = await uploadStorageObject(bucket, path, file, options);

  if (uploadError) {
    logProfileHeroUpload("storage upload error", uploadError.message);
    return { publicUrl: null, error: uploadError.message, storagePath: path };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const rawUrl = (data?.publicUrl ?? "").trim();
  const publicUrl = rawUrl ? withProfileImageCacheBust(rawUrl) : null;

  logProfileHeroUpload("storage upload success", { storagePath: path, publicUrl });

  return {
    publicUrl,
    error: publicUrl ? null : "Öffentliche URL konnte nicht erzeugt werden.",
    storagePath: path,
  };
}

export async function uploadPlayerProfileAvatar(
  teamSeasonId: string,
  playerId: string,
  file: File,
): Promise<{ avatarUrl: string | null; error: string | null }> {
  const ext = avatarExtension(file);
  const avatarPath = `${teamSeasonId}/${playerId}.${ext}`;
  const { publicUrl: avatarUrl, error } = await uploadToBucket(
    PLAYER_AVATAR_BUCKET,
    avatarPath,
    file,
    playerUploadOptions(file, teamSeasonId, playerId, "avatar"),
  );
  return { avatarUrl, error };
}

export async function uploadPlayerProfileCutout(
  teamSeasonId: string,
  playerId: string,
  file: File,
): Promise<{ cutoutUrl: string | null; error: string | null; storagePath?: string }> {
  const ext = cutoutExtension(file);
  const cutoutPath = `${teamSeasonId}/cutouts/${playerId}.${ext}`;
  const cutout = await uploadToBucket(
    PLAYER_AVATAR_BUCKET,
    cutoutPath,
    file,
    playerUploadOptions(file, teamSeasonId, playerId, "hero"),
  );
  return { cutoutUrl: cutout.publicUrl, error: cutout.error, storagePath: cutout.storagePath };
}

/** Kombinierter Upload (Pipeline-Kompatibilität). */
export async function uploadPlayerProfilePhoto(
  teamSeasonId: string,
  playerId: string,
  file: File,
): Promise<ProfilePhotoUploadResult> {
  const { avatarUrl, error } = await uploadPlayerProfileAvatar(teamSeasonId, playerId, file);
  if (error) {
    return { avatarUrl: null, cutoutUrl: null, error };
  }

  let cutoutUrl: string | null = null;
  if (await shouldStoreProfileCutout(file)) {
    const cutout = await uploadPlayerProfileCutout(teamSeasonId, playerId, file);
    if (!cutout.error) {
      cutoutUrl = cutout.cutoutUrl;
    }
  }

  return { avatarUrl, cutoutUrl, error: null };
}

export async function uploadStaffProfileAvatar(
  teamSeasonId: string,
  userId: string,
  file: File,
): Promise<{ avatarUrl: string | null; error: string | null }> {
  const ext = avatarExtension(file);
  const avatarPath = `${teamSeasonId}/staff/${userId}.${ext}`;
  const { publicUrl: avatarUrl, error } = await uploadToBucket(
    STAFF_PHOTO_BUCKET,
    avatarPath,
    file,
    staffUploadOptions(file, teamSeasonId, userId, "avatar"),
  );
  return { avatarUrl, error };
}

export async function uploadStaffProfileCutout(
  teamSeasonId: string,
  userId: string,
  file: File,
): Promise<{ cutoutUrl: string | null; error: string | null; storagePath?: string }> {
  const ext = cutoutExtension(file);
  const cutoutPath = `${teamSeasonId}/cutouts/${userId}.${ext}`;
  const cutout = await uploadToBucket(
    STAFF_PHOTO_BUCKET,
    cutoutPath,
    file,
    staffUploadOptions(file, teamSeasonId, userId, "hero"),
  );
  return { cutoutUrl: cutout.publicUrl, error: cutout.error, storagePath: cutout.storagePath };
}

/** Kombinierter Upload (Pipeline-Kompatibilität). */
export async function uploadStaffProfilePhoto(
  teamSeasonId: string,
  userId: string,
  file: File,
): Promise<ProfilePhotoUploadResult> {
  const { avatarUrl, error } = await uploadStaffProfileAvatar(teamSeasonId, userId, file);
  if (error) {
    return { avatarUrl: null, cutoutUrl: null, error };
  }

  let cutoutUrl: string | null = null;
  if (await shouldStoreProfileCutout(file)) {
    const cutout = await uploadStaffProfileCutout(teamSeasonId, userId, file);
    if (!cutout.error) {
      cutoutUrl = cutout.cutoutUrl;
    }
  }

  return { avatarUrl, cutoutUrl, error: null };
}
