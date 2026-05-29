/**
 * Profil-Hero: Cutout (PNG/WebP mit Alpha) vs. Premium-Avatar (normales Foto).
 * Upload: profileCutoutUpload.ts speichert cutout_url bei transparenten PNG/WebP.
 */

export type ProfileHeroLayoutMode = "cutout" | "avatar";

/** Nur wenn cutout_url gesetzt ist — normale Fotos bleiben im Avatar-Modus. */
export function hasCutoutUrl(cutoutUrl?: string | null): boolean {
  return (cutoutUrl ?? "").trim().length > 0;
}

export function resolveProfileCutoutSrc(cutoutUrl?: string | null): string | null {
  const cutout = (cutoutUrl ?? "").trim();
  return cutout || null;
}

export function resolveProfilePhotoSrc(photoUrl?: string | null): string | null {
  const photo = (photoUrl ?? "").trim();
  return photo || null;
}

/** Layout: Cutout-Banner nur bei vorhandenem cutout_url (nach erfolgreichem Laden). */
export function profileHeroLayoutMode(
  cutoutUrl?: string | null,
  cutoutLoadOk = true,
): ProfileHeroLayoutMode {
  if (hasCutoutUrl(cutoutUrl) && cutoutLoadOk) return "cutout";
  return "avatar";
}
