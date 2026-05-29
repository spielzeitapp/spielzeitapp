/**
 * Profil-Hero: Bildquelle für Stadion-Banner (Cutout vs. Fallback-Foto).
 *
 * TODO (Phase 2 — Upload-Pipeline, keine externe API in Phase 1):
 * - Beim Foto-Upload Originalfoto speichern (photo_url / avatar_url)
 * - Hintergrund serverseitig entfernen (eigener Worker/Job, noch offen)
 * - PNG mit Transparenz als cutout_url persistieren (player.cutout_url / profiles.cutout_url)
 * - Hero bevorzugt cutout_url; Fallback bleibt photo_url
 */

export type ProfileHeroImageMode = "cutout" | "photo";

export type ResolvedProfileHeroImage = {
  src: string;
  mode: ProfileHeroImageMode;
};

/** Bevorzugt cutout_url, sonst photo_url/avatar_url. Leer → null (Initialen). */
export function resolveProfileHeroImage(
  cutoutUrl?: string | null,
  photoUrl?: string | null,
): ResolvedProfileHeroImage | null {
  const cutout = (cutoutUrl ?? "").trim();
  if (cutout) return { src: cutout, mode: "cutout" };

  const photo = (photoUrl ?? "").trim();
  if (photo) return { src: photo, mode: "photo" };

  return null;
}
