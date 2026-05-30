/** Gemeinsame Limits für Avatar- und Hero-Cutout-Uploads. */
export const PROFILE_AVATAR_MAX_MB = 3;
export const PROFILE_CUTOUT_MAX_MB = 3;

export const PROFILE_AVATAR_MAX_BYTES = PROFILE_AVATAR_MAX_MB * 1024 * 1024;
export const PROFILE_CUTOUT_MAX_BYTES = PROFILE_CUTOUT_MAX_MB * 1024 * 1024;

export const PROFILE_AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";
export const PROFILE_CUTOUT_ACCEPT = "image/png,image/jpeg,image/webp";

export const PROFILE_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PROFILE_CUTOUT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function isAllowedProfileAvatarFile(file: File): boolean {
  if (PROFILE_AVATAR_MIME_TYPES.includes(file.type as (typeof PROFILE_AVATAR_MIME_TYPES)[number])) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function isAllowedProfileCutoutFile(file: File): boolean {
  if (PROFILE_CUTOUT_MIME_TYPES.includes(file.type as (typeof PROFILE_CUTOUT_MIME_TYPES)[number])) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function validateProfileAvatarFile(file: File): string | null {
  if (!isAllowedProfileAvatarFile(file)) {
    return "Bitte nur JPG, PNG oder WebP für das Listenbild.";
  }
  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    return `Listenbild zu groß (max. ${PROFILE_AVATAR_MAX_MB} MB).`;
  }
  return null;
}

export function validateProfileCutoutFile(file: File): string | null {
  if (!isAllowedProfileCutoutFile(file)) {
    return "Profil-Hero: bitte JPG, PNG oder WebP hochladen.";
  }
  if (file.size > PROFILE_CUTOUT_MAX_BYTES) {
    return `Hero-Bild zu groß (max. ${PROFILE_CUTOUT_MAX_MB} MB).`;
  }
  return null;
}
