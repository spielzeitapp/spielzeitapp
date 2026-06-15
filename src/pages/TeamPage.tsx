import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSession, getTeamNameFromMembership, getSeasonLabelFromMembership } from "../auth/useSession";
import { AppButton } from "../components/ui/AppButton";
import {
  GlassCard,
  PageShell,
  PremiumButton,
  PremiumCard,
  PremiumEmptyState,
  PremiumTab,
  PremiumTabTrack,
  SectionTitle,
} from "../ui";
import { Camera } from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { usePlayers, type PlayerItem } from "../hooks/usePlayers";
import { normalizeRole, canManageRoster, canManageMatches } from "../lib/roles";
import { getPositionLabel } from "../lib/positionLabels";
import { supabase } from "../lib/supabaseClient";
import { uploadPlayerProfileAvatar, uploadPlayerProfileCutout, logProfileHeroUpload } from "../lib/profileCutoutUpload";
import { uploadStorageObject } from "../lib/storageUpload";
import { prepareCutoutGeneration } from "../lib/profileImagePipeline";
import { PlayerProfileModal } from "../components/team/PlayerProfileModal";
import { PlayerSquadFormModal } from "../components/team/PlayerSquadFormModal";
import { TrainerStaffFormModal } from "../components/team/TrainerStaffFormModal";
import { PlayerCard } from "../components/team/PlayerCard";
import { STAFF_RPC_MIGRATION_HINT, useTeamStaff } from "../hooks/useTeamStaff";
import { useTrainerStaffEditor } from "../hooks/useTrainerStaffEditor";
import { TrainerStaffCard } from "../components/team/TrainerStaffCard";
import { TeamTrainingDashboard } from "../components/team/TeamTrainingDashboard";
import type { ProfileTab } from "../components/team/PlayerProfileModal";

/** Lokales Fallback, wenn kein Mannschaftsfoto in `team_photos` hinterlegt ist. */
const TEAM_HERO_PLACEHOLDER = "/team/team-placeholder.png";

type TeamTabId = "squad" | "trainers" | "training" | "matches";
type SquadFilterId = "active" | "paused" | "all";

const TEAM_TABS: { id: TeamTabId; label: string }[] = [
  { id: "squad", label: "Kader" },
  { id: "trainers", label: "Trainer" },
  { id: "training", label: "Training" },
  { id: "matches", label: "Spiele" },
];

type TeamNavState = {
  tab?: string;
  clearSelectedPlayer?: boolean;
};

function isTeamTabId(value: string | null | undefined): value is TeamTabId {
  return (
    value === "squad" ||
    value === "trainers" ||
    value === "training" ||
    value === "matches"
  );
}

function readInitialTeamTab(): TeamTabId {
  if (typeof window === "undefined") return "squad";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return isTeamTabId(tab) ? tab : "squad";
}

type RecentMatchRow = {
  id: string;
  opponent: string | null;
  match_date: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
};

type TeamPhotoRow = {
  team_season_id: string;
  photo_url: string;
  updated_at?: string | null;
};

type FormState = {
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: string;
  /** `YYYY-MM-DD` fürs Datumsfeld; leer = kein Geburtsdatum */
  birthdate: string;
};

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  jersey_number: "",
  position: "",
  birthdate: "",
};

/** Normalisiert `YYYY-MM-DD` oder deutsches `DD.MM.YYYY` für die DB-Spalte `date`. */
function toISODate(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.includes(".")) {
    const [d, m, y] = v.split(".").map((p) => p.trim());
    if (!d || !m || !y) return null;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return v;
}

/** Parst Jersey-String: leer → null, sonst Number; gültig nur wenn Number.isFinite(n) && n > 0. */
function parseJersey(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Unique-Constraint für Trikot pro team_season (Postgres + ggf. Constraint-Name). */
function isJerseyDuplicateError(err: { code?: string; message?: string }): boolean {
  return err.code === "23505" || (err.message ?? "").includes("players_unique_jersey_per_teamseason");
}

function readOptionalPhotoUrl(p: PlayerItem): string | null {
  const v = (p.avatar_url ?? "").trim();
  return v.length > 0 ? v : null;
}

function formatMatchDateDe(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMatchResult(m: RecentMatchRow): string {
  const st = (m.status ?? "").trim().toLowerCase();
  if (st === "live") return "Live";
  if (st !== "finished") return "—";
  const h = m.score_home;
  const a = m.score_away;
  if (h == null || a == null) return "—";
  return `${h} : ${a}`;
}

function readTeamPhotoUrl(row: TeamPhotoRow | null): string | null {
  const v = (row?.photo_url ?? "").trim();
  return v.length > 0 ? v : null;
}

export const TeamPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { selectedTeamSeason, selectedMembership, loading: sessionLoading } = useSession();
  const {
    teamLabel,
    teamSeasonId,
    role,
    loading: tsLoading,
    error: tsError,
  } = useActiveTeamSeason();
  const {
    players,
    loading: plLoading,
    error: plError,
    refetch: refetchPlayers,
  } = usePlayers(teamSeasonId, {
    mode: canManageRoster(normalizeRole(role)) ? "all" : "active",
  });

  const roleNormalized = normalizeRole(role);
  const canManagePlayers = canManageRoster(roleNormalized);
  const canViewTrainingKaiser = canManageMatches(roleNormalized);
  const tabsReady = !sessionLoading && !tsLoading;

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<PlayerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cutoutUploading, setCutoutUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [cutoutPreviewUrl, setCutoutPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cutoutFile, setCutoutFile] = useState<File | null>(null);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);
  const [cutoutObjectUrl, setCutoutObjectUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastLabel, setSaveToastLabel] = useState("Gespeichert");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<PlayerItem | null>(null);
  const [profileInitialTab, setProfileInitialTab] = useState<ProfileTab>("overview");
  const {
    staff: staffRows,
    loading: staffLoading,
    error: staffFetchError,
    staffRpcMissing,
    refetch: refetchStaff,
  } = useTeamStaff(teamSeasonId);

  const trainerEditor = useTrainerStaffEditor({
    teamSeasonId,
    onAfterSave: async () => {
      const { error: fetchErr } = await refetchStaff();
      if (!fetchErr) showSavedToast("Trainer gespeichert");
    },
  });
  const [recentMatches, setRecentMatches] = useState<RecentMatchRow[]>([]);
  const [teamPhoto, setTeamPhoto] = useState<TeamPhotoRow | null>(null);
  const [teamPhotoUploading, setTeamPhotoUploading] = useState(false);
  const [teamPhotoError, setTeamPhotoError] = useState<string | null>(null);
  const [trainingCount, setTrainingCount] = useState(0);
  const teamPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const heroTeamName = useMemo(() => {
    const fromTs = selectedTeamSeason?.team?.name?.trim();
    if (fromTs) return fromTs;
    const fromMem = getTeamNameFromMembership(selectedMembership)?.trim();
    if (fromMem) return fromMem;
    const label = (teamLabel ?? "").trim();
    const paren = label.indexOf("(");
    if (paren > 0) return label.slice(0, paren).trim();
    return label || "Team";
  }, [selectedTeamSeason, selectedMembership, teamLabel]);

  const heroSeason = useMemo(() => {
    const fromTs = selectedTeamSeason?.season?.name?.trim();
    if (fromTs) return fromTs;
    const fromMem = getSeasonLabelFromMembership(selectedMembership)?.trim();
    if (fromMem && fromMem !== "—") return fromMem;
    const label = (teamLabel ?? "").trim();
    const m = /\(([^)]+)\)/.exec(label);
    return m?.[1]?.trim() ?? "—";
  }, [selectedTeamSeason, selectedMembership, teamLabel]);

  const trainerCount = useMemo(() => staffRows.length, [staffRows]);
  const teamPhotoUrl = useMemo(() => readTeamPhotoUrl(teamPhoto), [teamPhoto]);
  const heroPhotoSrc = useMemo(
    () => (teamPhotoUrl && teamPhotoUrl.length > 0 ? teamPhotoUrl : TEAM_HERO_PLACEHOLDER),
    [teamPhotoUrl],
  );
  const heroShowsPlaceholder = !teamPhotoUrl || teamPhotoUrl.length === 0;

  useEffect(() => {
    if (!teamSeasonId) {
      setRecentMatches([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("matches")
      .select("id, opponent, match_date, status, score_home, score_away")
      .eq("team_season_id", teamSeasonId)
      .order("match_date", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setRecentMatches([]);
          return;
        }
        setRecentMatches((data ?? []) as RecentMatchRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  useEffect(() => {
    if (!teamSeasonId) {
      setTeamPhoto(null);
      setTeamPhotoError(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("team_photos")
      .select("team_season_id, photo_url, updated_at")
      .eq("team_season_id", teamSeasonId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setTeamPhoto(null);
          return;
        }
        setTeamPhoto((data as TeamPhotoRow | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  useEffect(() => {
    if (!teamSeasonId) {
      setTrainingCount(0);
      return;
    }
    let cancelled = false;
    void supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("team_season_id", teamSeasonId)
      .eq("kind", "training")
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          setTrainingCount(0);
          return;
        }
        setTrainingCount(Number(count ?? 0) || 0);
      });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  const handleTeamPhotoPick = async (file: File) => {
    if (!teamSeasonId) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setTeamPhotoError("Bitte nur JPG, PNG oder WebP hochladen.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setTeamPhotoError("Datei ist zu groß (max. 4 MB).");
      return;
    }
    setTeamPhotoError(null);
    setTeamPhotoUploading(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const uploadPath = `${teamSeasonId}/hero.${ext}`;
    const { error: uploadError } = await uploadStorageObject("team-photos", uploadPath, file, {
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) {
      setTeamPhotoUploading(false);
      setTeamPhotoError(`Upload fehlgeschlagen: ${uploadError.message}`);
      return;
    }
    const { data: publicData } = supabase.storage.from("team-photos").getPublicUrl(uploadPath);
    const publicUrl = (publicData?.publicUrl ?? "").trim();
    if (!publicUrl) {
      setTeamPhotoUploading(false);
      setTeamPhotoError("Öffentliche URL für das Mannschaftsfoto konnte nicht ermittelt werden.");
      return;
    }
    const { data: upserted, error: upsertError } = await supabase
      .from("team_photos")
      .upsert(
        { team_season_id: teamSeasonId, photo_url: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: "team_season_id" }
      )
      .select("team_season_id, photo_url, updated_at")
      .maybeSingle();
    setTeamPhotoUploading(false);
    if (upsertError) {
      setTeamPhotoError(`Mannschaftsfoto: ${upsertError.message}`);
      return;
    }
    if (!upserted) {
      setTeamPhotoError("Mannschaftsfoto: Eintrag in team_photos wurde nicht zurückgegeben (RLS oder Berechtigung prüfen).");
      return;
    }
    setTeamPhoto(upserted as TeamPhotoRow);
  };

  const clearImageLocalPreviews = () => {
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    if (cutoutObjectUrl) URL.revokeObjectURL(cutoutObjectUrl);
    setAvatarObjectUrl(null);
    setCutoutObjectUrl(null);
    setAvatarFile(null);
    setCutoutFile(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setMode("create");
    setForm(emptyForm);
    setEditingId(null);
    setEditingPlayer(null);
    setAvatarPreviewUrl(null);
    setCutoutPreviewUrl(null);
    clearImageLocalPreviews();
    setFormError(null);
  };

  const openCreateForm = () => {
    setForm(emptyForm);
    setMode("create");
    setEditingId(null);
    setEditingPlayer(null);
    setAvatarPreviewUrl(null);
    setCutoutPreviewUrl(null);
    clearImageLocalPreviews();
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (p: PlayerItem) => {
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      jersey_number: p.jersey_number != null ? String(p.jersey_number) : "",
      position: p.position ?? "",
      birthdate: p.birthdate ? p.birthdate.slice(0, 10) : "",
    });
    setMode("edit");
    setEditingId(p.id);
    setEditingPlayer(p);
    setAvatarPreviewUrl(readOptionalPhotoUrl(p));
    setCutoutPreviewUrl((p.cutout_url ?? "").trim() || null);
    clearImageLocalPreviews();
    setFormError(null);
    setShowForm(true);
  };

  const openPlayerProfile = (p: PlayerItem) => {
    setSelectedProfilePlayer(p);
    setProfileInitialTab("overview");
  };

  const closePlayerProfile = () => {
    setSelectedProfilePlayer(null);
    setProfileInitialTab("overview");
  };

  const handleEditFromProfile = () => {
    const snapshot = selectedProfilePlayer;
    setSelectedProfilePlayer(null);
    if (!snapshot) return;
    const fresh = players.find((x) => x.id === snapshot.id) ?? snapshot;
    openEditForm(fresh);
  };

  useEffect(() => {
    if (!selectedProfilePlayer?.id) return;
    const next = players.find((x) => x.id === selectedProfilePlayer.id);
    if (next) setSelectedProfilePlayer(next);
  }, [players, selectedProfilePlayer?.id]);

  useEffect(() => {
    return () => {
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
      if (cutoutObjectUrl) URL.revokeObjectURL(cutoutObjectUrl);
    };
  }, [avatarObjectUrl, cutoutObjectUrl]);

  useEffect(() => {
    if (!saveToastVisible) return;
    const t = window.setTimeout(() => setSaveToastVisible(false), 2400);
    return () => window.clearTimeout(t);
  }, [saveToastVisible]);

  const showSavedToast = (label = "Gespeichert") => {
    setSaveToastLabel(label);
    setSaveToastVisible(true);
  };

  const handleAvatarFilePick = (file: File) => {
    setFormError(null);
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    setAvatarFile(file);
    setAvatarObjectUrl(URL.createObjectURL(file));
  };

  const handleCutoutFilePick = (file: File) => {
    setFormError(null);
    if (cutoutObjectUrl) URL.revokeObjectURL(cutoutObjectUrl);
    setCutoutFile(file);
    setCutoutObjectUrl(URL.createObjectURL(file));
  };

  const handlePauseFromModal = () => {
    if (!editingId || !editingPlayer) return;
    const nextStatus = (editingPlayer.status ?? "active") === "paused" ? "active" : "paused";
    void handleSetPlayerStatus(editingId, nextStatus);
  };

  const parsedJerseyNumber = parseJersey(form.jersey_number);
  const isJerseyTaken = (jersey: number | null): boolean => {
    if (jersey == null) return false;
    return players.some(
      (p) => p.jersey_number != null && p.jersey_number === jersey && p.id !== editingId
    );
  };
  const jerseyTaken = isJerseyTaken(parsedJerseyNumber);
  const jerseyErrorMsg = jerseyTaken && parsedJerseyNumber != null
    ? `Nummer ${parsedJerseyNumber} ist bereits vergeben.`
    : null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePlayers) return;
    const { first_name, last_name } = form;
    if (!first_name.trim()) return;
    if (jerseyTaken) {
      setFormError(jerseyErrorMsg ?? "Diese Nummer ist bereits vergeben.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const jersey = parsedJerseyNumber;

    if (mode === "create") {
      if (teamSeasonId == null) {
        setFormError("Keine Mannschaftssaison ausgewählt.");
        setSaving(false);
        return;
      }
      const { data: insertedRows, error: insertError } = await supabase
        .from("players")
        .insert({
          team_season_id: teamSeasonId,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          jersey_number: form.jersey_number ? Number(form.jersey_number) : null,
          position: form.position?.trim() || null,
          is_active: true,
          status: "active",
        })
        .select("id");
      if (insertError) {
        setFormError(
          isJerseyDuplicateError(insertError as { code?: string; message?: string })
            ? `Nummer ${jersey ?? ""} ist bereits vergeben. Bitte eine andere Nummer wählen.`
            : insertError.message
        );
        setSaving(false);
        return;
      }
      const newPlayerId = (insertedRows as { id: string }[] | null)?.[0]?.id;
      if (!newPlayerId) {
        setFormError("Spieler angelegt, aber Spieler-ID fehlt – Geburtsdatum bitte später bearbeiten.");
        setSaving(false);
        await refetchPlayers();
        closeForm();
        return;
      }
      const { error: profileError } = await supabase.from("player_profiles").upsert(
        {
          player_id: newPlayerId,
          birthdate: form.birthdate ? toISODate(form.birthdate) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "player_id" }
      );
      if (profileError) {
        setFormError(profileError.message);
        setSaving(false);
        await refetchPlayers();
        return;
      }
      setSaving(false);
      await refetchPlayers();
      showSavedToast();
      closeForm();
      return;
    } else {
      if (editingPlayer == null) {
        setSaving(false);
        return;
      }
      if (!teamSeasonId) {
        setSaving(false);
        setFormError("Keine Mannschaftssaison ausgewählt.");
        return;
      }
      let nextAvatarUrl = avatarPreviewUrl;
      let savedHeroCutoutUrl: string | null = null;
      if (avatarFile) {
        setAvatarUploading(true);
        const { avatarUrl: uploadedAvatar, error: uploadError } = await uploadPlayerProfileAvatar(
          teamSeasonId,
          editingPlayer.id,
          avatarFile,
        );
        if (uploadError || !uploadedAvatar) {
          setAvatarUploading(false);
          setSaving(false);
          setFormError(
            `Avatar-Upload fehlgeschlagen: ${uploadError ?? "Unbekannter Fehler"}. Bitte Storage-Policy/Bucket prüfen.`,
          );
          return;
        }

        const { data: updatedPlayer, error: avatarUpdateError } = await supabase
          .from("player_avatars")
          .upsert(
            {
              player_id: editingPlayer.id,
              avatar_url: uploadedAvatar,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "player_id" },
          )
          .select("*")
          .maybeSingle();

        if (avatarUpdateError) {
          setAvatarUploading(false);
          setSaving(false);
          setFormError(`Avatar gespeichert, aber URL nicht gesetzt: ${avatarUpdateError.message}`);
          return;
        }

        nextAvatarUrl = (updatedPlayer?.avatar_url as string | null | undefined) ?? uploadedAvatar;
        setAvatarUploading(false);

        const generated = await prepareCutoutGeneration({
          subject: "player",
          teamSeasonId,
          entityId: editingPlayer.id,
          avatarUrl: uploadedAvatar,
        });
        if (generated.cutoutUrl) {
          const { error: cutoutColError } = await supabase
            .from("players")
            .update({ cutout_url: generated.cutoutUrl })
            .eq("id", editingPlayer.id);
          if (cutoutColError && !/cutout_url/i.test(cutoutColError.message)) {
            setSaving(false);
            setFormError(`Cutout gespeichert, aber DB-Feld fehlt: ${cutoutColError.message}`);
            return;
          }
        }
      }

      if (cutoutFile) {
        logProfileHeroUpload("player hero file pending upload", {
          name: cutoutFile.name,
          type: cutoutFile.type,
          size: cutoutFile.size,
        });
        setCutoutUploading(true);
        const { cutoutUrl: uploadedCutout, error: cutoutUploadError, storagePath } =
          await uploadPlayerProfileCutout(teamSeasonId, editingPlayer.id, cutoutFile);
        setCutoutUploading(false);
        if (cutoutUploadError || !uploadedCutout) {
          setSaving(false);
          setFormError(`Hero-Bild fehlgeschlagen: ${cutoutUploadError ?? "Unbekannter Fehler"}`);
          return;
        }
        logProfileHeroUpload("player hero upload complete", { storagePath, cutoutUrl: uploadedCutout });

        const { data: savedCutoutRow, error: cutoutColError } = await supabase
          .from("players")
          .update({ cutout_url: uploadedCutout })
          .eq("id", editingPlayer.id)
          .select("cutout_url")
          .maybeSingle();

        if (cutoutColError && !/cutout_url/i.test(cutoutColError.message)) {
          setSaving(false);
          setFormError(`Hero-Bild gespeichert, aber DB-Feld fehlt: ${cutoutColError.message}`);
          return;
        }

        savedHeroCutoutUrl = (savedCutoutRow?.cutout_url as string | null | undefined) ?? uploadedCutout;
        logProfileHeroUpload("player saved cutout_url", {
          cutout_url: savedHeroCutoutUrl,
        });
      }
      const { error: updateError } = await supabase
        .from("players")
        .update({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          jersey_number: form.jersey_number ? Number(form.jersey_number) : null,
          position: form.position?.trim() || null,
        })
        .eq("id", editingPlayer.id);
      if (updateError) {
        setFormError(
          isJerseyDuplicateError(updateError as { code?: string; message?: string })
            ? `Nummer ${jersey ?? ""} ist bereits vergeben. Bitte eine andere Nummer wählen.`
            : updateError.message
        );
        setSaving(false);
        return;
      }
      const { error: profileError } = await supabase.from("player_profiles").upsert(
        {
          player_id: editingPlayer.id,
          birthdate: form.birthdate ? toISODate(form.birthdate) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "player_id" }
      );
      if (profileError) {
        setFormError(profileError.message);
        setSaving(false);
        await refetchPlayers();
        return;
      }
      if (nextAvatarUrl) setAvatarPreviewUrl(nextAvatarUrl);
      setSaving(false);
      await refetchPlayers();
      logProfileHeroUpload("player refetch after save done");
      if (selectedProfilePlayer?.id === editingPlayer.id && savedHeroCutoutUrl) {
        setSelectedProfilePlayer((prev) =>
          prev ? { ...prev, cutout_url: savedHeroCutoutUrl } : prev,
        );
      }
      showSavedToast();
      closeForm();
    }
  };

  const handleSetPlayerStatus = async (playerId: string, nextStatus: "active" | "paused") => {
    if (!window.confirm(nextStatus === "paused" ? "Spieler pausieren?" : "Spieler wieder aktivieren?")) return;
    setDeletingId(playerId);
    const { error } = await supabase
      .from("players")
      .update({ is_active: nextStatus === "active", status: nextStatus })
      .eq("id", playerId);
    setDeletingId(null);
    if (error) {
      setFormError(error.message);
      return;
    }
    if (editingId === playerId) {
      showSavedToast();
      closeForm();
    }
    await refetchPlayers();
  };

  const [activeTab, setActiveTab] = useState<TeamTabId>(readInitialTeamTab);
  const [squadFilter, setSquadFilter] = useState<SquadFilterId>("active");

  const clearPlayerDetailState = () => {
    setSelectedProfilePlayer(null);
    setShowForm(false);
    setEditingId(null);
    setEditingPlayer(null);
    setFormError(null);
  };

  const handleTeamTabChange = (tabId: TeamTabId) => {
    clearPlayerDetailState();
    setActiveTab(tabId);
  };

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab");
    if (tabFromQuery === "parents") return;

    const navState = (location.state as TeamNavState | null) ?? null;
    const hasNavState = navState != null && Object.keys(navState).length > 0;
    const tab = isTeamTabId(tabFromQuery)
      ? tabFromQuery
      : isTeamTabId(navState?.tab)
        ? navState.tab
        : null;

    if (!tab) return;

    if (navState?.clearSelectedPlayer) {
      clearPlayerDetailState();
    }
    setActiveTab(tab);

    if (hasNavState) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    }
  }, [searchParams, location.state, location.pathname, location.search, navigate]);

  const sortedPlayers = useMemo(() => {
    const list = players.filter((p) => {
      const st = p.status ?? "active";
      if (squadFilter === "all") return true;
      if (squadFilter === "paused") return st === "paused";
      return st === "active";
    });
    return [...list].sort((a, b) => {
      const ja = a.jersey_number ?? 9999;
      const jb = b.jersey_number ?? 9999;
      if (ja !== jb) return ja - jb;
      return a.display_name.localeCompare(b.display_name, "de");
    });
  }, [players, squadFilter]);

  const activeCount = useMemo(
    () => players.filter((p) => (p.status ?? "active") === "active").length,
    [players]
  );
  const pausedCount = useMemo(
    () => players.filter((p) => (p.status ?? "active") === "paused").length,
    [players]
  );

  if (searchParams.get("tab") === "parents") {
    return <Navigate to="/app/mehr/parent-access" replace />;
  }

  return (
    <>
    {selectedProfilePlayer ? (
      <PlayerProfileModal
        player={selectedProfilePlayer}
        role={role}
        teamSeasonLabel={teamLabel}
        teamName={heroTeamName}
        photoUrl={readOptionalPhotoUrl(selectedProfilePlayer)}
        canManage={canManagePlayers}
        initialTab={profileInitialTab}
        onClose={closePlayerProfile}
        onEdit={handleEditFromProfile}
        onPlayerUpdated={(patch) => {
          setSelectedProfilePlayer((prev) => (prev ? { ...prev, ...patch } : prev));
          void refetchPlayers();
        }}
      />
    ) : null}
    {canManagePlayers && teamSeasonId != null ? (
      <TrainerStaffFormModal
        isOpen={trainerEditor.showTrainerForm}
        mode={trainerEditor.trainerFormMode}
        form={trainerEditor.trainerForm}
        editingTrainer={trainerEditor.editingTrainer}
        saving={trainerEditor.trainerSaving}
        avatarUploading={trainerEditor.trainerAvatarUploading}
        cutoutUploading={trainerEditor.trainerCutoutUploading}
        avatarPreviewUrl={trainerEditor.trainerAvatarPreviewUrl}
        cutoutPreviewUrl={trainerEditor.trainerCutoutPreviewUrl}
        avatarObjectUrl={trainerEditor.trainerAvatarObjectUrl}
        cutoutObjectUrl={trainerEditor.trainerCutoutObjectUrl}
        formError={trainerEditor.trainerFormError}
        onClose={trainerEditor.closeTrainerForm}
        onSubmit={trainerEditor.handleTrainerFormSubmit}
        onFormChange={(patch) => trainerEditor.setTrainerForm((f) => ({ ...f, ...patch }))}
        onAvatarFile={trainerEditor.handleTrainerAvatarFilePick}
        onCutoutFile={trainerEditor.handleTrainerCutoutFilePick}
        onImageValidationError={trainerEditor.setTrainerFormError}
        onAccountEmailBlur={() => void trainerEditor.handleTrainerAccountEmailBlur()}
      />
    ) : null}
    {canManagePlayers && teamSeasonId != null ? (
      <PlayerSquadFormModal
        isOpen={showForm}
        mode={mode}
        form={form}
        editingPlayer={editingPlayer}
        saving={saving}
        avatarUploading={avatarUploading}
        cutoutUploading={cutoutUploading}
        avatarPreviewUrl={avatarPreviewUrl}
        cutoutPreviewUrl={cutoutPreviewUrl}
        avatarObjectUrl={avatarObjectUrl}
        cutoutObjectUrl={cutoutObjectUrl}
        formError={formError}
        jerseyErrorMsg={jerseyErrorMsg}
        canManage={canManagePlayers}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onAvatarFile={handleAvatarFilePick}
        onCutoutFile={handleCutoutFilePick}
        onImageValidationError={setFormError}
        onPausePlayer={mode === "edit" ? handlePauseFromModal : undefined}
        pauseBusy={deletingId !== null}
      />
    ) : null}
    {saveToastVisible ? (
      <div
        className="pointer-events-none fixed left-1/2 top-[max(1rem,env(safe-area-inset-top,0px))] z-[1001] -translate-x-1/2"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-full border border-white/12 bg-[rgba(8,8,12,0.94)] px-4 py-2 text-[13px] font-medium text-white/92 shadow-[0_10px_36px_rgba(0,0,0,0.55)] backdrop-blur-md">
          {saveToastLabel}
        </div>
      </div>
    ) : null}
    <PageShell
      variant="subtle"
      showAtmosphere={false}
      className="page team-page min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-3 pb-36 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-none space-y-4 md:max-w-3xl lg:max-w-4xl"
    >
      {/* Team Hero */}
      <PremiumCard matchday showAmbientGlow className="!p-0 overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.5)]">
      <div className="relative min-h-[160px] sm:min-h-[178px]">
        <img
          src={heroPhotoSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className={
            heroShowsPlaceholder
              ? "pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(48,10,10,0.55)_0%,rgba(14,14,18,0.72)_50%,rgba(8,8,12,0.85)_100%)]"
              : "pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(48,10,10,0.96)_0%,rgba(14,14,18,0.98)_45%,rgba(8,8,12,1)_100%)]"
          }
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14] bg-[repeating-linear-gradient(90deg,transparent,transparent_14px,rgba(255,255,255,0.04)_14px,rgba(255,255,255,0.04)_16px)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-red-600/20 blur-3xl" aria-hidden />
        <div className="relative z-10 flex min-h-[160px] flex-col justify-end p-5 sm:min-h-[178px] sm:p-6">
          {canManagePlayers ? (
            <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:right-4 sm:top-4">
              <input
                ref={teamPhotoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void handleTeamPhotoPick(file);
                  if (teamPhotoInputRef.current) teamPhotoInputRef.current.value = "";
                }}
              />
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={teamPhotoUploading || !teamSeasonId}
                onClick={() => teamPhotoInputRef.current?.click()}
                title="Mannschaftsfoto"
                className="h-9 gap-1 px-2.5 backdrop-blur-sm hover:border-red-400/40 hover:bg-black/60 sm:h-8"
              >
                <Camera className="h-4 w-4 shrink-0 text-red-300/95" aria-hidden />
                <span className="text-[11px] font-medium text-white/85">Foto</span>
              </AppButton>
            </div>
          ) : null}
          <div>
            <p className="text-lg font-bold leading-tight text-white sm:text-xl">
              {tsLoading ? "Lade Team…" : heroTeamName}
            </p>
            <p className="mt-1 text-[14px] text-white/70">{heroSeason}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[14px] text-white/70">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-black/35 px-2.5 py-1">
              {tsLoading || plLoading ? "…" : `${activeCount} Spieler`}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-black/35 px-2.5 py-1">
              {staffLoading ? "…" : `${trainerCount} Trainer`}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-black/35 px-2.5 py-1">
              Saison {heroSeason}
            </span>
          </div>
        </div>
      </div>
      </PremiumCard>
      {teamPhotoError ? (
        <p className="text-sm text-red-600" role="alert">
          {teamPhotoError}
        </p>
      ) : null}

      {tsError ? (
        <p className="text-sm text-red-600" role="alert">
          {tsError}
        </p>
      ) : null}

      <GlassCard
        variant="subtle"
        showAmbientGlow={false}
        className="sticky top-0 z-20 !p-1 backdrop-blur-md"
      >
        {tabsReady ? (
          <PremiumTabTrack className="min-w-0">
            {TEAM_TABS.map((tab) => (
              <PremiumTab
                key={tab.id}
                kind="filter"
                active={activeTab === tab.id}
                onClick={() => handleTeamTabChange(tab.id)}
                className="min-w-0 px-1.5 text-[10px] sm:px-2.5 sm:text-[12px]"
              >
                {tab.label}
              </PremiumTab>
            ))}
          </PremiumTabTrack>
        ) : (
          <div
            className="flex min-h-[42px] items-center justify-center px-3"
            aria-busy="true"
            aria-label="Team-Tabs werden geladen"
          >
            <span className="text-[11px] font-medium text-white/45">Lade Team…</span>
          </div>
        )}
      </GlassCard>

      {activeTab === "squad" ? (
      <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
            Kader
          </SectionTitle>
          {teamSeasonId != null && canManagePlayers && !plLoading ? (
            <PremiumButton type="button" variant="interactive" onClick={() => openCreateForm()} className="!min-h-[40px] shrink-0 !px-3 !py-2 !text-sm">
              + Spieler hinzufügen
            </PremiumButton>
          ) : null}
        </div>
        <div className="mt-2">
          {teamSeasonId == null && !tsLoading && (
            <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="mt-3 py-6" />
          )}
          {teamSeasonId != null && plLoading && (
            <p className="mt-3 text-sm text-white/55">Lade Kader…</p>
          )}
          {teamSeasonId != null && !plLoading && plError && (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {plError}
            </p>
          )}
          {teamSeasonId != null && !plLoading && !plError && players.length === 0 && !showForm && (
            <PremiumEmptyState variant="subtle" title="Noch keine Spieler angelegt." className="mt-3 py-6" />
          )}
          {teamSeasonId != null && !plLoading && !plError && players.length > 0 && (
            <>
              {canManagePlayers ? (
                <div className="mb-2 mt-2 space-y-2">
                  <p className="text-xs text-white/60">
                    Pausierte Spieler bleiben gespeichert, sind aber für Eltern/Fans und Spielkader nicht sichtbar.
                  </p>
                  <PremiumTabTrack className="min-w-0">
                    <PremiumTab
                      kind="filter"
                      active={squadFilter === "active"}
                      onClick={() => setSquadFilter("active")}
                      className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
                    >
                      Aktiv ({activeCount})
                    </PremiumTab>
                    <PremiumTab
                      kind="filter"
                      active={squadFilter === "paused"}
                      onClick={() => setSquadFilter("paused")}
                      className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
                    >
                      Pausiert ({pausedCount})
                    </PremiumTab>
                    <PremiumTab
                      kind="filter"
                      active={squadFilter === "all"}
                      onClick={() => setSquadFilter("all")}
                      className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
                    >
                      Alle ({players.length})
                    </PremiumTab>
                  </PremiumTabTrack>
                </div>
              ) : null}
            <ul className="mt-3 w-full space-y-1.5 pb-8">
              {sortedPlayers.map((p) => (
                <li key={p.id} className="w-full">
                  <div className="space-y-1">
                    <PlayerCard
                      player={{
                        id: p.id,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        display_name: p.display_name,
                        position: getPositionLabel(p.position) || p.position,
                        jersey_number: p.jersey_number,
                        photo_url: readOptionalPhotoUrl(p),
                      }}
                      onClick={() => openPlayerProfile(p)}
                    />
                    <div className="flex items-center justify-between px-2">
                      {(p.status ?? "active") === "paused" ? (
                        <span className="rounded-full border border-amber-400/35 bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          Pausiert
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-900/25 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                          Aktiv
                        </span>
                      )}
                      {canManagePlayers ? (
                        <button
                          type="button"
                          disabled={deletingId !== null || saving}
                          onClick={() =>
                            void handleSetPlayerStatus(
                              p.id,
                              (p.status ?? "active") === "paused" ? "active" : "paused"
                            )
                          }
                          className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/[0.08] disabled:opacity-50"
                        >
                          {(p.status ?? "active") === "paused" ? "Wieder aktivieren" : "Pausieren"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            </>
          )}
        </div>
      </PremiumCard>
      ) : null}

      {activeTab === "trainers" ? (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
              Trainer
            </SectionTitle>
            {teamSeasonId != null && canManagePlayers && !staffLoading ? (
              <PremiumButton
                type="button"
                variant="interactive"
                onClick={trainerEditor.openCreateTrainerForm}
                className="!min-h-[40px] shrink-0 !px-3 !py-2 !text-sm"
              >
                + Trainer hinzufügen
              </PremiumButton>
            ) : null}
          </div>
          {teamSeasonId == null && !tsLoading ? (
            <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="mt-3 py-6" />
          ) : staffLoading ? (
            <p className="mt-4 text-[14px] text-white/70">Lade Trainer…</p>
          ) : staffFetchError ? (
            <p
              className="mt-4 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[14px] text-red-300"
              role="alert"
            >
              Trainer konnten nicht geladen werden: {staffFetchError}
            </p>
          ) : staffRows.length === 0 ? (
            <PremiumEmptyState variant="subtle" title="Keine Trainer hinterlegt" className="mt-4 py-6" />
          ) : (
            <>
              {staffRpcMissing ? (
                <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-[13px] text-amber-100/95">
                  {STAFF_RPC_MIGRATION_HINT}
                </p>
              ) : null}
              <ul className="mt-3 w-full space-y-1.5 pb-8">
                {staffRows.map((row) => (
                  <li key={`${row.user_id}-${row.role}`} className="w-full">
                    <TrainerStaffCard
                      member={row}
                      onClick={() => navigate(`/app/team/trainer/${encodeURIComponent(row.user_id)}`)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </PremiumCard>
      ) : null}

      {activeTab === "training" ? (
        teamSeasonId == null && !tsLoading ? (
          <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
            <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="py-6" />
          </PremiumCard>
        ) : canViewTrainingKaiser && teamSeasonId != null ? (
          <TeamTrainingDashboard
            players={players}
            teamSeasonId={teamSeasonId}
            trainingCount={trainingCount}
            onPlayerClick={(player) => {
              setProfileInitialTab("training");
              setSelectedProfilePlayer(player);
            }}
          />
        ) : (
          <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
            <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
              Training
            </SectionTitle>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-3">
                  <div className="text-[12px] text-white/60">Anzahl Trainings</div>
                  <div className="mt-1 text-[22px] font-bold text-white">{trainingCount}</div>
                </GlassCard>
              </div>
              {trainingCount === 0 ? (
                <PremiumEmptyState variant="subtle" title="Noch keine Trainingsdaten" className="py-6" />
              ) : null}
            </div>
          </PremiumCard>
        )
      ) : null}

      {activeTab === "matches" ? (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
          <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
            Spiele
          </SectionTitle>
          {teamSeasonId == null && !tsLoading ? (
            <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="mt-3 py-6" />
          ) : recentMatches.length === 0 ? (
            <PremiumEmptyState variant="subtle" title="Keine Spiele vorhanden" className="mt-4 py-6" />
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-white/60">Nächste / letzte Spiele</p>
                <ul className="space-y-2.5">
                  {recentMatches.map((m) => (
                    <li key={m.id}>
                      <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="line-clamp-2 min-w-0 text-[17px] font-semibold leading-snug text-white">
                            {(m.opponent ?? "").trim() || "—"}
                          </span>
                          <span className="shrink-0 tabular-nums text-white/80">{formatMatchResult(m)}</span>
                        </div>
                        <div className="mt-1 text-[12px] text-white/60">{formatMatchDateDe(m.match_date)}</div>
                      </GlassCard>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </PremiumCard>
      ) : null}
    </PageShell>
    </>
  );
};

