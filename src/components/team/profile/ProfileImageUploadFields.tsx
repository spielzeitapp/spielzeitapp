import React, { useRef } from "react";
import { AppButton } from "../../ui/AppButton";
import {
  PROFILE_AVATAR_ACCEPT,
  PROFILE_CUTOUT_ACCEPT,
  validateProfileAvatarFile,
  validateProfileCutoutFile,
} from "../../../lib/profileImageUploadConfig";
import { logProfileHeroUpload } from "../../../lib/profileCutoutUpload";

type Props = {
  mode: "create" | "edit";
  canUpload: boolean;
  busy: boolean;
  avatarUploading: boolean;
  cutoutUploading: boolean;
  avatarPreviewSrc: string | null;
  cutoutPreviewSrc: string | null;
  avatarInitials: string;
  onAvatarFile: (file: File) => void;
  onCutoutFile: (file: File) => void;
  onValidationError: (message: string) => void;
};

function RoundPreview({
  src,
  initials,
  shape = "round",
}: {
  src: string | null;
  initials: string;
  shape?: "round" | "hero";
}) {
  const round = shape === "round";
  const boxClass = round ? "h-14 w-14 rounded-full" : "h-14 w-[3.25rem] rounded-lg";
  const imgClass = round
    ? "h-14 w-14 rounded-full object-cover"
    : "h-14 w-[3.25rem] rounded-lg object-contain object-bottom";

  return (
    <div className={`relative shrink-0 ${boxClass} border border-red-900/35 bg-zinc-900/80`}>
      {src ? (
        <img
          src={src}
          alt=""
          className={imgClass}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const next = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (next) next.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className={`flex ${boxClass} items-center justify-center text-sm font-bold text-white/75`}
        style={{ display: src ? "none" : "flex" }}
        aria-hidden
      >
        {initials}
      </div>
    </div>
  );
}

function UploadSection({
  label,
  hint,
  buttonLabel,
  uploading,
  disabled,
  preview,
  initials,
  previewShape,
  onPick,
}: {
  label: string;
  hint: string;
  buttonLabel: string;
  uploading: boolean;
  disabled: boolean;
  preview: string | null;
  initials: string;
  previewShape: "round" | "hero";
  onPick: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <RoundPreview src={preview} initials={initials} shape={previewShape} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-semibold text-white/88">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-white/45">{hint}</p>
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={disabled}
          onClick={onPick}
        >
          {uploading ? "Upload…" : buttonLabel}
        </AppButton>
      </div>
    </div>
  );
}

export const ProfileImageUploadFields: React.FC<Props> = ({
  mode,
  canUpload,
  busy,
  avatarUploading,
  cutoutUploading,
  avatarPreviewSrc,
  cutoutPreviewSrc,
  avatarInitials,
  onAvatarFile,
  onCutoutFile,
  onValidationError,
}) => {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cutoutInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDisabled = mode !== "edit" || !canUpload || busy;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateProfileAvatarFile(file);
    if (err) {
      onValidationError(err);
      return;
    }
    logProfileHeroUpload("selected avatar file", {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    onAvatarFile(file);
  };

  const handleCutoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateProfileCutoutFile(file);
    if (err) {
      onValidationError(err);
      return;
    }
    logProfileHeroUpload("selected hero cutout file", {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    onCutoutFile(file);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {mode === "create" ? (
        <p className="text-[11px] leading-snug text-white/40">
          Profilbilder nach dem Anlegen im Bearbeiten-Dialog hochladen.
        </p>
      ) : null}

      <UploadSection
        label="Rundes Listenbild"
        hint="JPG/PNG/WebP · max. 3 MB · Teamliste & Feed"
        buttonLabel="Avatar hochladen"
        uploading={avatarUploading}
        disabled={uploadDisabled}
        preview={avatarPreviewSrc}
        initials={avatarInitials}
        previewShape="round"
        onPick={() => avatarInputRef.current?.click()}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept={PROFILE_AVATAR_ACCEPT}
        className="hidden"
        onChange={handleAvatarChange}
      />

      <UploadSection
        label="Profil-Hero Bild"
        hint="JPG/PNG/WebP · max. 3 MB · Freistellung für Stadion-Hero"
        buttonLabel="Freigestelltes Bild hochladen"
        uploading={cutoutUploading}
        disabled={uploadDisabled}
        preview={cutoutPreviewSrc}
        initials={avatarInitials}
        previewShape="hero"
        onPick={() => cutoutInputRef.current?.click()}
      />
      <input
        ref={cutoutInputRef}
        type="file"
        accept={PROFILE_CUTOUT_ACCEPT}
        className="hidden"
        onChange={handleCutoutChange}
      />
    </div>
  );
};
