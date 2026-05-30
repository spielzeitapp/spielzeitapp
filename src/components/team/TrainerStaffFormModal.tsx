import React from "react";
import { Modal } from "../../app/ui/Modal";
import { AppButton } from "../ui/AppButton";
import { ProfileImageUploadFields } from "./profile/ProfileImageUploadFields";
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
  cutoutUploading: boolean;
  avatarPreviewUrl: string | null;
  cutoutPreviewUrl: string | null;
  avatarObjectUrl: string | null;
  cutoutObjectUrl: string | null;
  formError: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormChange: (patch: Partial<TrainerStaffFormState>) => void;
  onAvatarFile: (file: File) => void;
  onCutoutFile: (file: File) => void;
  onImageValidationError: (message: string) => void;
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
  cutoutUploading,
  avatarPreviewUrl,
  cutoutPreviewUrl,
  avatarObjectUrl,
  cutoutObjectUrl,
  formError,
  onClose,
  onSubmit,
  onFormChange,
  onAvatarFile,
  onCutoutFile,
  onImageValidationError,
  onAccountEmailBlur,
}) => {
  const busy = saving || avatarUploading || cutoutUploading;
  const avatarPreviewSrc = avatarObjectUrl || avatarPreviewUrl;
  const cutoutPreviewSrc = cutoutObjectUrl || cutoutPreviewUrl;

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

        <ProfileImageUploadFields
          mode={mode}
          canUpload={editingTrainer != null}
          busy={busy}
          avatarUploading={avatarUploading}
          cutoutUploading={cutoutUploading}
          avatarPreviewSrc={avatarPreviewSrc}
          cutoutPreviewSrc={cutoutPreviewSrc}
          avatarInitials={avatarInitials(form)}
          onAvatarFile={onAvatarFile}
          onCutoutFile={onCutoutFile}
          onValidationError={onImageValidationError}
        />

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
