import { useCallback, useEffect, useState } from "react";
import type { TrainerStaffFormState } from "../components/team/TrainerStaffFormModal";
import { uploadStaffProfileAvatar, uploadStaffProfileCutout } from "../lib/profileCutoutUpload";
import { prepareCutoutGeneration } from "../lib/profileImagePipeline";
import {
  findAccountUserIdByEmail,
  fetchProfileNamesForUser,
  isValidAccountEmail,
  saveTeamStaffMember,
  type TeamStaffMember,
} from "./useTeamStaff";

export const emptyTrainerForm: TrainerStaffFormState = {
  email: "",
  first_name: "",
  last_name: "",
  role: "trainer",
  phone: "",
  contact_email: "",
};

type Options = {
  teamSeasonId: string | null;
  onAfterSave?: () => void | Promise<void>;
};

export function useTrainerStaffEditor({ teamSeasonId, onAfterSave }: Options) {
  const [showTrainerForm, setShowTrainerForm] = useState(false);
  const [trainerFormMode, setTrainerFormMode] = useState<"create" | "edit">("create");
  const [trainerForm, setTrainerForm] = useState<TrainerStaffFormState>(emptyTrainerForm);
  const [editingTrainer, setEditingTrainer] = useState<TeamStaffMember | null>(null);
  const [trainerSaving, setTrainerSaving] = useState(false);
  const [trainerAvatarUploading, setTrainerAvatarUploading] = useState(false);
  const [trainerCutoutUploading, setTrainerCutoutUploading] = useState(false);
  const [trainerAvatarPreviewUrl, setTrainerAvatarPreviewUrl] = useState<string | null>(null);
  const [trainerCutoutPreviewUrl, setTrainerCutoutPreviewUrl] = useState<string | null>(null);
  const [trainerAvatarFile, setTrainerAvatarFile] = useState<File | null>(null);
  const [trainerCutoutFile, setTrainerCutoutFile] = useState<File | null>(null);
  const [trainerAvatarObjectUrl, setTrainerAvatarObjectUrl] = useState<string | null>(null);
  const [trainerCutoutObjectUrl, setTrainerCutoutObjectUrl] = useState<string | null>(null);
  const [trainerFormError, setTrainerFormError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (trainerAvatarObjectUrl) URL.revokeObjectURL(trainerAvatarObjectUrl);
      if (trainerCutoutObjectUrl) URL.revokeObjectURL(trainerCutoutObjectUrl);
    };
  }, [trainerAvatarObjectUrl, trainerCutoutObjectUrl]);

  const clearTrainerImagePreviews = useCallback(() => {
    if (trainerAvatarObjectUrl) URL.revokeObjectURL(trainerAvatarObjectUrl);
    if (trainerCutoutObjectUrl) URL.revokeObjectURL(trainerCutoutObjectUrl);
    setTrainerAvatarObjectUrl(null);
    setTrainerCutoutObjectUrl(null);
    setTrainerAvatarFile(null);
    setTrainerCutoutFile(null);
  }, [trainerAvatarObjectUrl, trainerCutoutObjectUrl]);

  const closeTrainerForm = useCallback(() => {
    setShowTrainerForm(false);
    setEditingTrainer(null);
    setTrainerForm(emptyTrainerForm);
    setTrainerFormError(null);
    setTrainerAvatarPreviewUrl(null);
    setTrainerCutoutPreviewUrl(null);
    clearTrainerImagePreviews();
  }, [clearTrainerImagePreviews]);

  const openCreateTrainerForm = useCallback(() => {
    setTrainerFormMode("create");
    setEditingTrainer(null);
    setTrainerForm(emptyTrainerForm);
    setTrainerFormError(null);
    setTrainerAvatarPreviewUrl(null);
    setTrainerCutoutPreviewUrl(null);
    clearTrainerImagePreviews();
    setShowTrainerForm(true);
  }, [clearTrainerImagePreviews]);

  const openEditTrainerForm = useCallback(
    (member: TeamStaffMember) => {
      setTrainerFormMode("edit");
      setEditingTrainer(member);
      setTrainerForm({
        email: "",
        first_name: member.first_name ?? "",
        last_name: member.last_name ?? "",
        role:
          member.role === "head_coach" || member.role === "co_trainer" || member.role === "trainer"
            ? member.role
            : "trainer",
        phone: member.phone ?? "",
        contact_email: member.email ?? "",
      });
      setTrainerFormError(null);
      setTrainerAvatarPreviewUrl(member.avatar_url);
      setTrainerCutoutPreviewUrl((member.cutout_url ?? "").trim() || null);
      clearTrainerImagePreviews();
      setShowTrainerForm(true);
    },
    [clearTrainerImagePreviews],
  );

  const handleTrainerAvatarFilePick = useCallback(
    (file: File) => {
      if (trainerAvatarObjectUrl) URL.revokeObjectURL(trainerAvatarObjectUrl);
      setTrainerAvatarFile(file);
      setTrainerAvatarObjectUrl(URL.createObjectURL(file));
    },
    [trainerAvatarObjectUrl],
  );

  const handleTrainerCutoutFilePick = useCallback(
    (file: File) => {
      if (trainerCutoutObjectUrl) URL.revokeObjectURL(trainerCutoutObjectUrl);
      setTrainerCutoutFile(file);
      setTrainerCutoutObjectUrl(URL.createObjectURL(file));
    },
    [trainerCutoutObjectUrl],
  );

  const handleTrainerAccountEmailBlur = useCallback(async () => {
    if (trainerFormMode !== "create") return;
    const email = trainerForm.email.trim();
    if (!email || !isValidAccountEmail(email)) return;
    const { userId, error } = await findAccountUserIdByEmail(email);
    if (error || !userId) return;
    const names = await fetchProfileNamesForUser(userId);
    if (!names) return;
    setTrainerForm((f) => ({
      ...f,
      first_name: f.first_name.trim() || (names.first_name ?? "").trim(),
      last_name: f.last_name.trim() || (names.last_name ?? "").trim(),
    }));
  }, [trainerFormMode, trainerForm.email]);

  const handleTrainerFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!teamSeasonId) {
        setTrainerFormError("Kein Team ausgewählt. Bitte Seite neu laden.");
        return;
      }
      if (trainerSaving) return;

      const contactEmail = trainerForm.contact_email.trim();
      if (contactEmail && !isValidAccountEmail(contactEmail)) {
        setTrainerFormError("Bitte eine gültige Kontakt-E-Mail eingeben oder das Feld leer lassen.");
        return;
      }

      setTrainerSaving(true);
      setTrainerFormError(null);
      try {
        let userId = editingTrainer?.user_id ?? null;
        if (trainerFormMode === "create") {
          const { userId: foundId, error: findError } = await findAccountUserIdByEmail(trainerForm.email);
          if (findError) {
            setTrainerFormError(findError);
            return;
          }
          if (!foundId) {
            setTrainerFormError("Kein Konto mit dieser E-Mail. Die Person muss sich zuerst registrieren.");
            return;
          }
          userId = foundId;
        }
        if (!userId) {
          setTrainerFormError("Trainer konnte nicht zugeordnet werden.");
          return;
        }

        let avatarUrl: string | null | undefined;
        let cutoutUrl: string | null | undefined;

        if (trainerAvatarFile) {
          setTrainerAvatarUploading(true);
          const { avatarUrl: uploadedAvatar, error: uploadErr } = await uploadStaffProfileAvatar(
            teamSeasonId,
            userId,
            trainerAvatarFile,
          );
          setTrainerAvatarUploading(false);
          if (uploadErr || !uploadedAvatar) {
            setTrainerFormError(`Avatar-Upload fehlgeschlagen: ${uploadErr ?? "Unbekannter Fehler"}`);
            return;
          }
          avatarUrl = uploadedAvatar;

          const generated = await prepareCutoutGeneration({
            subject: "staff",
            teamSeasonId,
            entityId: userId,
            avatarUrl: uploadedAvatar,
          });
          if (generated.cutoutUrl) {
            cutoutUrl = generated.cutoutUrl;
          }
        }

        if (trainerCutoutFile) {
          setTrainerCutoutUploading(true);
          const { cutoutUrl: uploadedCutout, error: cutoutErr } = await uploadStaffProfileCutout(
            teamSeasonId,
            userId,
            trainerCutoutFile,
          );
          setTrainerCutoutUploading(false);
          if (cutoutErr || !uploadedCutout) {
            setTrainerFormError(`Hero-Bild fehlgeschlagen: ${cutoutErr ?? "Unbekannter Fehler"}`);
            return;
          }
          cutoutUrl = uploadedCutout;
        }

        const { ok, error: saveError } = await saveTeamStaffMember({
          teamSeasonId,
          userId,
          role: trainerForm.role,
          firstName: trainerForm.first_name.trim() || null,
          lastName: trainerForm.last_name.trim() || null,
          phone: trainerForm.phone.trim() || null,
          contactEmail: contactEmail || null,
          avatarUrl: avatarUrl ?? null,
          cutoutUrl: cutoutUrl ?? null,
        });
        if (!ok || saveError) {
          setTrainerFormError(saveError ?? "Speichern fehlgeschlagen.");
          return;
        }

        closeTrainerForm();
        await onAfterSave?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
        setTrainerFormError(msg);
      } finally {
        setTrainerSaving(false);
        setTrainerAvatarUploading(false);
        setTrainerCutoutUploading(false);
      }
    },
    [
      teamSeasonId,
      trainerSaving,
      trainerForm,
      trainerFormMode,
      editingTrainer,
      trainerAvatarFile,
      trainerCutoutFile,
      closeTrainerForm,
      onAfterSave,
    ],
  );

  return {
    showTrainerForm,
    trainerFormMode,
    trainerForm,
    setTrainerForm,
    editingTrainer,
    trainerSaving,
    trainerAvatarUploading,
    trainerCutoutUploading,
    trainerAvatarPreviewUrl,
    trainerCutoutPreviewUrl,
    trainerAvatarObjectUrl,
    trainerCutoutObjectUrl,
    trainerFormError,
    setTrainerFormError,
    closeTrainerForm,
    openCreateTrainerForm,
    openEditTrainerForm,
    handleTrainerAvatarFilePick,
    handleTrainerCutoutFilePick,
    handleTrainerAccountEmailBlur,
    handleTrainerFormSubmit,
  };
};
