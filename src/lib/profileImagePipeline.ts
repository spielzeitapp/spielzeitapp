/**
 * Gemeinsame Profilbild-Pipeline (Phase 1: Vorbereitung).
 *
 * Aktuell delegiert uploadProfileAvatar() an die bestehenden Upload-Helper.
 * Keine KI-Freistellung — prepareCutoutGeneration() ist ein Stub für Phase 2/3.
 *
 * @see docs/profile-cutout-roadmap.md
 * @see profileCutoutUpload.ts — konkrete Storage-Uploads
 * @see profileHeroImage.ts — Hero-Layout-Auflösung
 */

import {
  uploadPlayerProfilePhoto,
  uploadStaffProfilePhoto,
  type ProfilePhotoUploadResult,
} from "./profileCutoutUpload";
import {
  hasCutoutUrl,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  resolveProfilePhotoSrc,
  type ProfileHeroLayoutMode,
} from "./profileHeroImage";

export type ProfileImageSubject = "player" | "staff";

export type UploadProfileAvatarInput = {
  subject: ProfileImageSubject;
  teamSeasonId: string;
  /** Spieler: players.id — Trainer: profiles.id / auth user id */
  entityId: string;
  file: File;
};

export type ResolvedProfileImages = {
  avatarUrl: string | null;
  cutoutUrl: string | null;
  /** Für Hero-Fallback (identisch mit avatarUrl, wenn gesetzt) */
  heroPhotoUrl: string | null;
  heroLayoutMode: ProfileHeroLayoutMode;
};

export type CutoutGenerationPlan = {
  /** Noch nicht ausgeführt — Platzhalter für Phase 2/3 */
  status: "skipped" | "pending_implementation";
  cutoutUrl: null;
  /** Original-Avatar-URL als Eingabe für künftige Freistellung */
  sourceAvatarUrl: string | null;
};

/**
 * Phase 1 — Ein Upload, zwei URLs (wenn transparentes PNG/WebP).
 * Delegiert unverändert an uploadPlayerProfilePhoto / uploadStaffProfilePhoto.
 */
export async function uploadProfileAvatar(
  input: UploadProfileAvatarInput,
): Promise<ProfilePhotoUploadResult> {
  const { subject, teamSeasonId, entityId, file } = input;

  if (subject === "player") {
    return uploadPlayerProfilePhoto(teamSeasonId, entityId, file);
  }

  return uploadStaffProfilePhoto(teamSeasonId, entityId, file);
}

/**
 * Phase 2/3 — Automatische Cutout-Erzeugung (Stub).
 * Wird aufgerufen, sobald Background Removal serverseitig verfügbar ist.
 */
export async function prepareCutoutGeneration(
  input: UploadProfileAvatarInput & { avatarUrl: string },
): Promise<CutoutGenerationPlan> {
  // STEP 2: background removal
  // - Original aus avatarUrl laden (Storage: player-avatars oder team-photos)
  // - Hintergrund entfernen (Edge Function / Worker — noch nicht angebunden)
  // - Ergebnis als PNG mit Alpha in {teamSeasonId}/cutouts/{entityId}.png speichern

  // STEP 3: generate cutout_url
  // - publicUrl des Cutouts in DB schreiben:
  //   Spieler → players.cutout_url (+ optional player_avatars)
  //   Trainer → profiles.cutout_url via upsert_team_staff_member(p_cutout_url)
  // - ProfileHeroCard bevorzugt cutout_url (profileHeroLayoutMode → "cutout")

  void input;

  return {
    status: "pending_implementation",
    cutoutUrl: null,
    sourceAvatarUrl: input.avatarUrl,
  };
}

/** Liest avatar_url + cutout_url für Listen, Karten und Hero. */
export function resolveProfileImages(
  avatarUrl?: string | null,
  cutoutUrl?: string | null,
  cutoutLoadOk = true,
): ResolvedProfileImages {
  const avatar = resolveProfilePhotoSrc(avatarUrl);
  const cutout = resolveProfileCutoutSrc(cutoutUrl);

  return {
    avatarUrl: avatar,
    cutoutUrl: cutout,
    heroPhotoUrl: avatar,
    heroLayoutMode: profileHeroLayoutMode(cutoutUrl, cutoutLoadOk && hasCutoutUrl(cutoutUrl)),
  };
}

export type { ProfilePhotoUploadResult, ProfileHeroLayoutMode };
