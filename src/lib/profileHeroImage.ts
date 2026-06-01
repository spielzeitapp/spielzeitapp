/**
 * Profil-Hero: Cutout vs. Avatar, Cache-Bust, Preload.
 */

export type ProfileHeroLayoutMode = "cutout" | "avatar";

/** Nur wenn cutout_url gesetzt ist. */
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

/** Layout stabil: bei cutout_url immer Cutout-Slot reservieren (unabhängig vom Bild-Laden). */
export function profileHeroLayoutMode(cutoutUrl?: string | null): ProfileHeroLayoutMode {
  if (hasCutoutUrl(cutoutUrl)) return "cutout";
  return "avatar";
}

/** Öffentliche Storage-URL mit Cache-Bust für zuverlässiges Überschreiben im Browser. */
export function withProfileImageCacheBust(url: string, version: string | number = Date.now()): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  const base = trimmed.split("?")[0];
  return `${base}?v=${encodeURIComponent(String(version))}`;
}

/** Bild im Hintergrund vorladen — reduziert sichtbares Nachladen. */
export function preloadProfileHeroImage(url: string | null | undefined): void {
  const src = (url ?? "").trim();
  if (!src || typeof Image === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}
