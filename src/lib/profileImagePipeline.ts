/**
 * Profilbild-Pipeline: Avatar-Upload + automatische Cutout-Erzeugung (Edge Function).
 *
 * @see docs/profile-cutout-roadmap.md
 * @see supabase/functions/remove-profile-background/
 */

import { supabase } from "./supabaseClient";
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
  entityId: string;
  file: File;
};

export type PrepareCutoutInput = {
  subject: ProfileImageSubject;
  teamSeasonId: string;
  entityId: string;
  avatarUrl: string;
};

export type CutoutGenerationResult = {
  status: "success" | "skipped" | "failed";
  cutoutUrl: string | null;
  warning: string | null;
  sourceAvatarUrl: string;
};

export type ResolvedProfileImages = {
  avatarUrl: string | null;
  cutoutUrl: string | null;
  heroPhotoUrl: string | null;
  heroLayoutMode: ProfileHeroLayoutMode;
};

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
 * STEP 2: background removal — Edge Function `remove-profile-background`
 * STEP 3: generate cutout_url — publicUrl zurück, Caller schreibt DB
 */
export async function prepareCutoutGeneration(
  input: PrepareCutoutInput,
): Promise<CutoutGenerationResult> {
  const entityType = input.subject === "player" ? "player" : "staff";

  try {
    const { data, error } = await supabase.functions.invoke("remove-profile-background", {
      body: {
        entityType,
        entityId: input.entityId,
        teamSeasonId: input.teamSeasonId,
        sourceImageUrl: input.avatarUrl,
      },
    });

    if (error) {
      console.warn("[profileImagePipeline] cutout Edge Function error:", error.message);
      return {
        status: "failed",
        cutoutUrl: null,
        warning: error.message,
        sourceAvatarUrl: input.avatarUrl,
      };
    }

    const payload = (data ?? {}) as { cutoutUrl?: string | null; warning?: string | null; error?: string };
    const cutoutUrl = (payload.cutoutUrl ?? "").trim() || null;

    if (payload.error) {
      console.warn("[profileImagePipeline] cutout rejected:", payload.error);
      return {
        status: "failed",
        cutoutUrl: null,
        warning: payload.error,
        sourceAvatarUrl: input.avatarUrl,
      };
    }

    if (!cutoutUrl) {
      const warning = (payload.warning ?? "").trim() || "Kein Cutout erzeugt";
      console.warn("[profileImagePipeline] cutout skipped:", warning);
      return {
        status: "skipped",
        cutoutUrl: null,
        warning,
        sourceAvatarUrl: input.avatarUrl,
      };
    }

    return {
      status: "success",
      cutoutUrl,
      warning: null,
      sourceAvatarUrl: input.avatarUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cutout-Generierung fehlgeschlagen";
    console.warn("[profileImagePipeline] cutout exception:", message);
    return {
      status: "failed",
      cutoutUrl: null,
      warning: message,
      sourceAvatarUrl: input.avatarUrl,
    };
  }
}

/** Nach Avatar-Upload: transparentes PNG behalten oder API-Cutout anfordern. */
export async function resolveCutoutAfterAvatarUpload(
  input: PrepareCutoutInput & { existingCutoutUrl?: string | null },
): Promise<string | null> {
  const existing = (input.existingCutoutUrl ?? "").trim();
  if (existing) return existing;

  const generated = await prepareCutoutGeneration(input);
  return generated.cutoutUrl;
}

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
    heroLayoutMode: profileHeroLayoutMode(cutoutUrl),
  };
}

export type { ProfilePhotoUploadResult, ProfileHeroLayoutMode };
