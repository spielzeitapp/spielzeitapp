import React, { useRef } from "react";
import { Modal } from "../../app/ui/Modal";
import { AppButton } from "../ui/AppButton";
import type { TeamStaffMember } from "../../hooks/useTeamStaff";

export type TrainerStaffFormState = {
  email: string;
  first_name: string;
  last_name: string;
  role: "trainer" | "co_trainer" | "head_coach";
  phone: string;
  contact_email: string;
};

type Props = {
  isOpen: boolean;
  mode: "create" | "edit";
  form: TrainerStaffFormState;
  editingTrainer: TeamStaffMember | null;
  saving: boolean;
  avatarUploading: boolean;
  avatarPreviewUrl: string | null;
  avatarObjectUrl: string | null;
  formError: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormChange: (patch: Partial<TrainerStaffFormState>) => void;
  onAvatarFile: (file: File) => void;
  onAvatarValidationError: (message: string) => void;
  onAccountEmailBlur?: () => void;
};

function formDisplayName(form: TrainerStaffFormState, member: TeamStaffMember | null): string {
  const full = `${form.first_name} ${form.last_name}`.trim();
  if (full) return full;
  const a = [member?.first_name, member?.last_name].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  return a || "Trainer";
}

function avatarInitials(form: TrainerStaffFormState): string {
  const a = (form.first_name || " ").trim().charAt(0);
  const b = (form.last_name || " ").trim().charAt(0);
  const s = `${a}${b}`.toUpperCase();
  return s || "TR";
}

export const TrainerStaffFormModal: React.FC<Props> = ({
  isOpen,
  mode,
  form,
  editingTrainer,
  saving,
  avatarUploading,
  avatarPreviewUrl,
  avatarObjectUrl,
  formError,
  onClose,
  onSubmit,
  onFormChange,
  onAvatarFile,
  onAvatarValidationError,
  onAccountEmailBlur,
}) => {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const busy = saving || avatarUploading;
  const previewSrc = avatarObjectUrl || avatarPreviewUrl;
  const canUploadPhoto = mode === "edit" && editingTrainer != null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      onAvatarValidationError("Bitte nur JPG, PNG oder WebP hochladen.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      onAvatarValidationError("Datei ist zu groß (max. 3 MB).");
      return;
    }
    onAvatarFile(file);
  };

  return (
    <Modal
      isOpen={isOpen}
      title={mode === "edit" ? "Trainer bearbeiten" : "Trainer hinzufügen"}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="flex w-full gap-2">
          <AppButton type="button" variant="secondary" className="min-h-[46px] flex-1" disabled={busy} onClick={onClose}>
            Abbrechen
          </AppButton>
          <AppButton
            type="submit"
            form="trainer-staff-form"
            variant="primary"
            className="min-h-[46px] flex-1"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Speichern…" : "Speichern"}
          </AppButton>
        </div>
      }
    >
      <form id="trainer-staff-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "edit" ? (
          <p className="-mt-1 text-[13px] font-medium text-white/55">{formDisplayName(form, editingTrainer)}</p>
        ) : null}

        <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="h-16 w-16 shrink-0">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                className="h-16 w-16 rounded-full border border-white/20 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-zinc-800 text-lg font-bold text-white/85"
              style={{ display: previewSrc ? "none" : "flex" }}
              aria-hidden
            >
              {avatarInitials(form)}
            </div>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canUploadPhoto || busy}
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUploading ? "Upload…" : "Foto hochladen"}
            </AppButton>
            <p className="mt-1.5 text-[11px] leading-snug text-white/45">JPG/PNG/WebP · max. 3 MB</p>
            {mode === "create" ? (
              <p className="mt-1 text-[11px] leading-snug text-white/38">Nach dem Anlegen im Profil bearbeiten.</p>
            ) : null}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {mode === "create" ? (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">E-Mail (Konto) *</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => onFormChange({ email: e.target.value })}
              onBlur={() => onAccountEmailBlur?.()}
              disabled={busy}
              className="min-h-[42px] rounded-lg border border-white/10 bg-black/40 px-3 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
              placeholder="trainer@beispiel.at"
            />
            <span className="text-[11px] text-white/45">Die Person muss bereits ein SpielzeitApp-Konto haben.</span>
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">Vorname</span>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => onFormChange({ first_name: e.target.value })}
              disabled={busy}
              className="min-h-[42px] rounded-lg border border-white/10 bg-black/40 px-3 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">Nachname</span>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => onFormChange({ last_name: e.target.value })}
              disabled={busy}
              className="min-h-[42px] rounded-lg border border-white/10 bg-black/40 px-3 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">Rolle</span>
          <select
            value={form.role}
            onChange={(e) => onFormChange({ role: e.target.value as TrainerStaffFormState["role"] })}
            disabled={busy}
            className="min-h-[42px] rounded-lg border border-white/10 bg-black/40 px-3 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
          >
            <option value="head_coach">Cheftrainer</option>
            <option value="co_trainer">Co-Trainer</option>
            <option value="trainer">Trainer</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">Telefon</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => onFormChange({ phone: e.target.value })}
            disabled={busy}
            className="min-h-[42px] rounded-lg border border-white/10 bg-black/40 px-3 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">E-Mail Kontakt</span>
          <input
            type="text"
            inputMode="email"
            autoComplete="off"
            value={form.contact_email}
            onChange={(e) => onFormChange({ contact_email: e.target.value })}
            disabled={busy}
            className="min-h-[42px] rounded-lg border border-white/10 bg-black/40 px-3 text-[15px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
          />
        </label>

        {formError ? (
          <p className="text-[13px] text-red-300" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
};
