import React, { useRef } from "react";
import { Modal } from "../../app/ui/Modal";
import { AppButton } from "../ui/AppButton";

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
  /** Nach Eingabe der Konto-E-Mail: Profilnamen vorschlagen (nur create). */
  onAccountEmailBlur?: () => void;
};

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
}) => {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const busy = saving || avatarUploading;
  const previewSrc = avatarObjectUrl || avatarPreviewUrl;

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
      <form id="trainer-staff-form" className="space-y-4 py-1" onSubmit={onSubmit}>
        {formError ? (
          <p className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[13px] text-red-300" role="alert">
            {formError}
          </p>
        ) : null}
        {mode === "create" ? (
          <div>
            <label className="mb-1 block text-[13px] font-medium text-white/85" htmlFor="trainer-email">
              E-Mail (Konto)
            </label>
            <input
              id="trainer-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => onFormChange({ email: e.target.value })}
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[15px] text-white outline-none focus:border-red-400/45"
              placeholder="trainer@beispiel.at"
            />
            <p className="mt-1 text-[11px] text-white/55">Die Person muss bereits ein SpielzeitApp-Konto haben.</p>
          </div>
        ) : null}

        <div className="flex items-center gap-4">
          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-white/15 bg-zinc-800">
            {previewSrc ? (
              <img src={previewSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg font-black text-white/90">
                {avatarInitials(form)}
              </span>
            )}
          </div>
          <div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <AppButton type="button" variant="secondary" size="sm" disabled={busy} onClick={() => avatarInputRef.current?.click()}>
              Foto wählen
            </AppButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-white/85" htmlFor="trainer-first">
              Vorname
            </label>
            <input
              id="trainer-first"
              value={form.first_name}
              onChange={(e) => onFormChange({ first_name: e.target.value })}
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[15px] text-white outline-none focus:border-red-400/45"
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-white/85" htmlFor="trainer-last">
              Nachname
            </label>
            <input
              id="trainer-last"
              value={form.last_name}
              onChange={(e) => onFormChange({ last_name: e.target.value })}
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[15px] text-white outline-none focus:border-red-400/45"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-white/85" htmlFor="trainer-role">
            Rolle
          </label>
          <select
            id="trainer-role"
            value={form.role}
            onChange={(e) => onFormChange({ role: e.target.value as TrainerStaffFormState["role"] })}
            className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[15px] text-white outline-none focus:border-red-400/45"
          >
            <option value="head_coach">Cheftrainer</option>
            <option value="co_trainer">Co-Trainer</option>
            <option value="trainer">Trainer</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-white/85" htmlFor="trainer-phone">
            Telefon (optional)
          </label>
          <input
            id="trainer-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => onFormChange({ phone: e.target.value })}
            className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[15px] text-white outline-none focus:border-red-400/45"
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-white/85" htmlFor="trainer-contact-email">
            E-Mail Kontakt (optional)
          </label>
          <input
            id="trainer-contact-email"
            type="text"
            inputMode="email"
            autoComplete="off"
            value={form.contact_email}
            onChange={(e) => onFormChange({ contact_email: e.target.value })}
            className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[15px] text-white outline-none focus:border-red-400/45"
          />
        </div>
      </form>
    </Modal>
  );
};
