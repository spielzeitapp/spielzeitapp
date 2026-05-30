import React, { useRef } from "react";
import { AppButton } from "../../ui/AppButton";

const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";
const CUTOUT_ACCEPT = "image/png,image/webp";
const AVATAR_MAX_MB = 3;
const CUTOUT_MAX_MB = 5;

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

function validateAvatar(file: File): string | null {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return "Bitte nur JPG, PNG oder WebP für das Listenbild.";
  if (file.size > AVATAR_MAX_MB * 1024 * 1024) return `Listenbild zu groß (max. ${AVATAR_MAX_MB} MB).`;
  return null;
}

function validateCutout(file: File): string | null {
  const allowed = ["image/png", "image/webp"];
  if (!allowed.includes(file.type) && !/\.(png|webp)$/i.test(file.name)) {
    return "Profil-Hero: bitte PNG oder WebP mit transparentem Hintergrund.";
  }
  if (file.size > CUTOUT_MAX_MB * 1024 * 1024) return `Hero-Bild zu groß (max. ${CUTOUT_MAX_MB} MB).`;
  return null;
}

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
    const err = validateAvatar(file);
    if (err) {
      onValidationError(err);
      return;
    }
    onAvatarFile(file);
  };

  const handleCutoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateCutout(file);
    if (err) {
      onValidationError(err);
      return;
    }
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
        hint="Wird in Teamliste, Trainerliste und Feed verwendet."
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
        accept={AVATAR_ACCEPT}
        className="hidden"
        onChange={handleAvatarChange}
      />

      <UploadSection
        label="Profil-Hero Bild"
        hint="PNG/WebP mit transparentem Hintergrund für den Stadion-Hero."
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
        accept={CUTOUT_ACCEPT}
        className="hidden"
        onChange={handleCutoutChange}
      />
    </div>
  );
};
