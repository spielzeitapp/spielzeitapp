import React from "react";
import { Camera, UserRound } from "lucide-react";
import "./playerSquadForm.css";
import { Modal } from "../../app/ui/Modal";
import { AppButton } from "../ui/AppButton";
import { ProfileImageUploadFields } from "./profile/ProfileImageUploadFields";
import type { PlayerItem } from "../../hooks/usePlayers";

export type PlayerSquadFormState = {
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: string;
  birthdate: string;
};

type Props = {
  isOpen: boolean;
  mode: "create" | "edit";
  form: PlayerSquadFormState;
  editingPlayer: PlayerItem | null;
  saving: boolean;
  avatarUploading: boolean;
  cutoutUploading: boolean;
  avatarPreviewUrl: string | null;
  cutoutPreviewUrl: string | null;
  avatarObjectUrl: string | null;
  cutoutObjectUrl: string | null;
  formError: string | null;
  jerseyErrorMsg: string | null;
  canManage: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormChange: (patch: Partial<PlayerSquadFormState>) => void;
  onAvatarFile: (file: File) => void;
  onCutoutFile: (file: File) => void;
  onImageValidationError: (message: string) => void;
  onPausePlayer?: () => void;
  pauseBusy?: boolean;
};

function formDisplayName(form: PlayerSquadFormState, player: PlayerItem | null): string {
  const full = `${form.first_name} ${form.last_name}`.trim();
  return full || player?.display_name?.trim() || "Spieler";
}

function avatarInitials(form: PlayerSquadFormState): string {
  const a = (form.first_name || " ").trim().charAt(0);
  const b = (form.last_name || " ").trim().charAt(0);
  const s = `${a}${b}`.toUpperCase();
  return s || "SP";
}

export const PlayerSquadFormModal: React.FC<Props> = ({
  isOpen,
  mode,
  form,
  editingPlayer,
  saving,
  avatarUploading,
  cutoutUploading,
  avatarPreviewUrl,
  cutoutPreviewUrl,
  avatarObjectUrl,
  cutoutObjectUrl,
  formError,
  jerseyErrorMsg,
  canManage,
  onClose,
  onSubmit,
  onFormChange,
  onAvatarFile,
  onCutoutFile,
  onImageValidationError,
  onPausePlayer,
  pauseBusy = false,
}) => {
  const busy = saving || avatarUploading || cutoutUploading;
  const avatarPreviewSrc = avatarObjectUrl || avatarPreviewUrl;
  const cutoutPreviewSrc = cutoutObjectUrl || cutoutPreviewUrl;
  const isPaused = (editingPlayer?.status ?? "active") === "paused";

  return (
    <Modal
      className="player-squad-modal"
      isOpen={isOpen}
      title={mode === "edit" ? "Spieler bearbeiten" : "Spieler hinzufügen"}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="flex w-full gap-2">
          <AppButton type="button" variant="secondary" className="min-h-12 flex-1 !rounded-full" disabled={busy} onClick={onClose}>
            Abbrechen
          </AppButton>
          <AppButton
            type="submit"
            form="player-squad-form"
            variant="primary"
            className="min-h-12 flex-1 !rounded-full"
            disabled={busy || !form.first_name.trim() || !form.last_name.trim() || Boolean(jerseyErrorMsg) || !canManage}
          >
            {saving ? "Speichern…" : "Speichern"}
          </AppButton>
        </div>
      }
    >
      <form id="player-squad-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "edit" ? (
          <p className="-mt-1 text-[13px] font-medium text-white/55">{formDisplayName(form, editingPlayer)}</p>
        ) : null}

        <div className="player-form-intro"><span className="player-form-icon"><UserRound size={22} aria-hidden /></span><div><strong>{mode === 'create' ? 'Neuer Spieler' : 'Spielerdaten'}</strong><p>{mode === 'create' ? 'Lege den Spieler für deine Mannschaft an.' : 'Daten und Fotos für die Spielerkarte bearbeiten.'}</p></div></div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-white/65">Vorname *</span>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => onFormChange({ first_name: e.target.value })}
              required
              disabled={busy || !canManage}
              className="min-h-12 rounded-xl border border-white/10 bg-black/40 px-3 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-white/65">Nachname *</span>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => onFormChange({ last_name: e.target.value })}
              required
              disabled={busy || !canManage}
              className="min-h-12 rounded-xl border border-white/10 bg-black/40 px-3 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-white/65">Nummer</span>
            <input
              type="number"
              min={1}
              max={99}
              value={form.jersey_number}
              onChange={(e) => onFormChange({ jersey_number: e.target.value })}
              disabled={busy || !canManage}
              className="min-h-12 rounded-xl border border-white/10 bg-black/40 px-3 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-white/65">Position</span>
            <input
              type="text"
              value={form.position}
              onChange={(e) => onFormChange({ position: e.target.value })}
              placeholder="z. B. ST"
              disabled={busy || !canManage}
              className="min-h-12 rounded-xl border border-white/10 bg-black/40 px-3 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-white/65">Geburtsdatum</span>
          <input
            type="date"
            value={form.birthdate || ""}
            onChange={(e) => onFormChange({ birthdate: e.target.value })}
            disabled={busy || !canManage}
            className="min-h-12 rounded-xl border border-white/10 bg-black/40 px-3 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-red-500/50"
          />
        </label>

        {mode === 'edit' ? <section className="player-form-photos">
          <div className="player-form-photo-heading"><Camera size={19} aria-hidden /><div><h3>Spielerfotos</h3><p>Für Teamliste und Spielerkarte</p></div></div>
        <ProfileImageUploadFields
          mode={mode}
          canUpload={Boolean(editingPlayer) && canManage}
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
        </section> : <div className="player-form-photo-hint"><Camera size={20} aria-hidden /><p><strong>Spielerfoto später ergänzen</strong><span>Nach dem Speichern kannst du Fotos im Bearbeiten-Dialog hochladen.</span></p></div>}

        {jerseyErrorMsg ? (
          <p className="text-[13px] text-red-300" role="alert">
            {jerseyErrorMsg}
          </p>
        ) : null}
        {formError ? (
          <p className="text-[13px] text-red-300" role="alert">
            {formError}
          </p>
        ) : null}

        {mode === "edit" && editingPlayer && onPausePlayer ? (
          <div className="border-t border-white/[0.06] pt-3">
            <button
              type="button"
              disabled={pauseBusy || busy}
              onClick={() => onPausePlayer()}
              className="w-full rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2.5 text-[13px] font-semibold text-red-300/90 transition-colors hover:bg-red-950/35 disabled:opacity-50"
            >
              {pauseBusy ? "Bitte warten…" : isPaused ? "Spieler wieder aktivieren" : "Spieler pausieren"}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-white/40">
              Pausierte Spieler sind für Eltern und Fans nicht sichtbar.
            </p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
};
