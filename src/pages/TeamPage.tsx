import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../auth/useSession";
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
import { ArrowLeft, Camera } from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { usePlayers, type PlayerItem } from "../hooks/usePlayers";
import { normalizeRole, canManageRoster, canManageMatches } from "../lib/roles";
import { assertTeamSeasonWritable } from "../lib/seasonTransition";
import {
  formatTeamSeasonCompactSwitcherLabel,
  resolveTeamSeasonSwitcherAction,
} from "../lib/seasonLifecycle";
import {
  createRosterPlayer,
  updateRosterPlayerSeasonFields,
} from "../lib/rosterService";
import { supabase } from "../lib/supabaseClient";
import { uploadPlayerProfileAvatar, uploadPlayerProfileCutout, logProfileHeroUpload } from "../lib/profileCutoutUpload";
import { uploadStorageObject } from "../lib/storageUpload";
import { prepareCutoutGeneration } from "../lib/profileImagePipeline";
import { PlayerProfileModal } from "../components/team/PlayerProfileModal";
import { PlayerSquadFormModal } from "../components/team/PlayerSquadFormModal";
import { TrainerStaffFormModal } from "../components/team/TrainerStaffFormModal";
import { TeamSquadShowcase } from "../components/team/TeamSquadShowcase";
import { TeamTrainerShowcase } from "../components/team/TeamTrainerShowcase";
import { STAFF_RPC_MIGRATION_HINT, useTeamStaff } from "../hooks/useTeamStaff";
import { useTrainerStaffEditor } from "../hooks/useTrainerStaffEditor";
import { TeamTrainingDashboard } from "../components/team/TeamTrainingDashboard";
import { TeamTrainingPublicOverview } from "../components/team/TeamTrainingPublicOverview";
import { SeasonMatchSummaryCard } from "../components/team/SeasonMatchSummaryCard";
import { SeasonMatchCard } from "../components/team/SeasonMatchCard";
import { useSeasonMatchBoard } from "../hooks/useSeasonMatchBoard";
import type { ProfileTab } from "../components/team/PlayerProfileModal";
import { useDemoMode } from "../demo/DemoContext";
import { useInternalBasePath } from "../demo/demoPaths";
import { buildDemoSeasonMatchBoard } from "../demo/demoMatchState";
import { DemoAiDisclosure } from "../demo/components/DemoAiDisclosure";
import {
  DEMO_MELK_AGE_GROUP,
  DEMO_MELK_HERO_URL,
  DEMO_MELK_LOGO_URL,
  DEMO_MELK_PLAYERS,
  DEMO_MELK_QUERY_VALUE,
  DEMO_MELK_SEASON,
  DEMO_MELK_TEAM_NAME,
} from "../demo/demoMelk";
import { useAvailabilityPermissions } from "../hooks/useAvailabilityPermissions";
import { getOurTeamDisplayName, getOurTeamLogoUrl } from "../lib/teamLogos";

/** Lokales Fallback, wenn kein Mannschaftsfoto in `team_photos` hinterlegt ist. */
const TEAM_HERO_PLACEHOLDER = "/team/team-demo-u12-v2.webp";

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

function readTeamPhotoUrl(row: TeamPhotoRow | null): string | null {
  const v = (row?.photo_url ?? "").trim();
  return v.length > 0 ? v : null;
}

export const TeamPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnToTrainingEvent = useMemo(() => {
    const target = searchParams.get("returnTo");
    if (!target) return null;
    return target.startsWith("/app/events/") || target.startsWith("/demo/events/")
      ? target
      : null;
  }, [searchParams]);
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const isMelkDemo = isDemo && searchParams.get("club") === DEMO_MELK_QUERY_VALUE;
  const basePath = useInternalBasePath();
  const { selectedTeamSeason, selectedMembership, loading: sessionLoading } = useSession();
  const {
    teamLabel: sessionTeamLabel,
    teamLine: sessionTeamLine,
    seasonLine: sessionSeasonLine,
    teamSeasonId: sessionTeamSeasonId,
    readTeamSeasonId: sessionReadTeamSeasonId,
    activeTeamSeasonId: sessionActiveTeamSeasonId,
    teamSeasons: sessionTeamSeasons,
    setViewTeamSeasonId,
    setSelectedTeamSeasonId,
    isHistoryReadOnly,
    softLockMessage,
    role: sessionRole,
    loading: tsLoadingRaw,
    error: tsErrorRaw,
  } = useActiveTeamSeason();

  const teamSeasonId = isDemo ? demo!.data.teamSeasonId : sessionTeamSeasonId;
  const readTeamSeasonId = isDemo ? demo!.data.teamSeasonId : sessionReadTeamSeasonId;
  const activeTeamSeasonId = isDemo ? demo!.data.teamSeasonId : sessionActiveTeamSeasonId;
  const teamSeasons = isDemo ? [] : sessionTeamSeasons;
  const role = isDemo ? "trainer" : sessionRole;
  const tsLoading = isDemo ? false : tsLoadingRaw;
  const tsError = isDemo ? null : tsErrorRaw;
  const teamLabel = isMelkDemo
    ? `${DEMO_MELK_TEAM_NAME} · ${DEMO_MELK_SEASON}`
    : isDemo
      ? `${demo!.data.teamName} · ${demo!.data.seasonLabel}`
    : sessionTeamLabel;
  const teamLine = isMelkDemo ? DEMO_MELK_TEAM_NAME : isDemo ? demo!.data.teamName : sessionTeamLine;
  const seasonLine = isMelkDemo ? DEMO_MELK_SEASON : isDemo ? demo!.data.seasonLabel : sessionSeasonLine;

  const {
    players: livePlayers,
    loading: plLoadingLive,
    error: plErrorLive,
    refetch: refetchPlayersLive,
  } = usePlayers(isDemo ? null : (readTeamSeasonId ?? teamSeasonId), {
    mode: canManageRoster(normalizeRole(role)) || isHistoryReadOnly ? "all" : "active",
  });
  const players = isMelkDemo ? DEMO_MELK_PLAYERS : isDemo ? demo!.players : livePlayers;
  /** Saisonweite Trainingsbeteiligung: nur active — auch im Archiv. */
  const trainingRosterPlayers = useMemo(
    () => players.filter((p) => (p.status ?? "active") === "active"),
    [players],
  );
  const plLoading = isDemo ? false : plLoadingLive;
  const plError = isDemo ? null : plErrorLive;
  const refetchPlayers = isDemo ? (async () => {}) : refetchPlayersLive;

  const roleNormalized = normalizeRole(role);
  /** Demo: Kader ansehen wie Trainer, aber keine Roster-Writes. */
  const canManagePlayers = !isDemo && canManageRoster(roleNormalized) && !isHistoryReadOnly;
  const canViewTrainingKaiser = isDemo || canManageMatches(roleNormalized);
  const tabsReady = isDemo || (!sessionLoading && !tsLoading);

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
    staff: staffRowsLive,
    loading: staffLoadingLive,
    error: staffFetchErrorLive,
    staffRpcMissing,
    refetch: refetchStaffLive,
  } = useTeamStaff(isDemo ? null : teamSeasonId);
  const staffRows = isDemo ? demo!.staff : staffRowsLive;
  const staffLoading = isDemo ? false : staffLoadingLive;
  const staffFetchError = isDemo ? null : staffFetchErrorLive;
  const refetchStaff = isDemo ? (async () => ({ error: null })) : refetchStaffLive;

  const trainerEditor = useTrainerStaffEditor({
    teamSeasonId: isDemo ? null : teamSeasonId,
    onAfterSave: async () => {
      if (isDemo) return;
      const { error: fetchErr } = await refetchStaff();
      if (!fetchErr) showSavedToast("Trainer gespeichert");
    },
  });
  const {
    summary: seasonMatchSummaryLive,
    upcoming: upcomingMatchesLive,
    recent: recentSeasonMatchesLive,
    all: allSeasonMatchesLive,
    loading: seasonMatchesLoadingLive,
    error: seasonMatchesErrorLive,
  } = useSeasonMatchBoard(isDemo ? null : teamSeasonId, isHistoryReadOnly ? 50 : 10, {
    includeOrphanMatches: isHistoryReadOnly,
  });

  const demoSeasonBoard = useMemo(() => {
    if (!isDemo || !demo) return null;
    const map = new Map(
      demo.data.events.map((e) => [e.id, { starts_at: e.starts_at, location: e.location }]),
    );
    return buildDemoSeasonMatchBoard(map);
  }, [isDemo, demo]);

  const seasonMatchSummary = demoSeasonBoard?.summary ?? seasonMatchSummaryLive;
  const upcomingMatches = demoSeasonBoard?.upcoming ?? upcomingMatchesLive;
  const recentSeasonMatches = demoSeasonBoard?.recent ?? recentSeasonMatchesLive;
  const allSeasonMatches = demoSeasonBoard?.all ?? allSeasonMatchesLive;
  const seasonMatchesLoading = isDemo ? false : seasonMatchesLoadingLive;
  const seasonMatchesError = isDemo ? null : seasonMatchesErrorLive;
  const [teamPhoto, setTeamPhoto] = useState<TeamPhotoRow | null>(null);
  const [teamPhotoUploading, setTeamPhotoUploading] = useState(false);
  const [teamPhotoError, setTeamPhotoError] = useState<string | null>(null);
  const teamPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const heroTeamName = useMemo(() => {
    if (isMelkDemo) return DEMO_MELK_TEAM_NAME;
    if (isDemo) return demo!.data.teamName;
    if (teamLine?.trim()) return teamLine.trim();
    const fromTs = selectedTeamSeason?.team?.name?.trim();
    if (fromTs) return fromTs;
    const label = (teamLabel ?? "").trim();
    if (label) {
      const bits = label.split(/\s*·\s*/);
      if (bits.length >= 2) return bits.slice(0, -1).join(" · ").trim();
      const paren = label.indexOf("(");
      if (paren > 0) return label.slice(0, paren).trim();
      return label;
    }
    return "Team";
  }, [teamLine, selectedTeamSeason, teamLabel, isDemo, isMelkDemo, demo]);

  const heroSeason = useMemo(() => {
    if (isMelkDemo) return DEMO_MELK_SEASON;
    if (isDemo) return demo!.data.seasonLabel;
    if (seasonLine?.trim() && seasonLine.trim() !== "—") return seasonLine.trim();
    const fromTs = selectedTeamSeason?.season?.name?.trim();
    if (fromTs) return fromTs;
    const label = (teamLabel ?? "").trim();
    const mid = label.split(/\s*·\s*/);
    if (mid.length >= 2) return mid[mid.length - 1]?.trim() || "—";
    const m = /\(([^)]+)\)/.exec(label);
    return m?.[1]?.trim() ?? "—";
  }, [seasonLine, selectedTeamSeason, teamLabel, isDemo, isMelkDemo, demo]);

  const heroAgeGroup = useMemo(() => {
    if (isMelkDemo) return DEMO_MELK_AGE_GROUP;
    if (isDemo) return "U12";
    const viewedSeason = teamSeasons.find((season) => season.id === readTeamSeasonId);
    const explicit = viewedSeason?.age_group?.trim() || selectedTeamSeason?.age_group?.trim();
    if (explicit) return explicit.toUpperCase();
    const parsed = /\bU\s*\d{1,2}\b/i.exec(`${heroTeamName} ${teamLabel ?? ""}`)?.[0];
    return parsed?.replace(/\s+/g, "").toUpperCase() ?? "TEAM";
  }, [isDemo, isMelkDemo, teamSeasons, readTeamSeasonId, selectedTeamSeason, heroTeamName, teamLabel]);

  const teamPhotoUrl = useMemo(() => readTeamPhotoUrl(teamPhoto), [teamPhoto]);
  const heroPhotoSrc = useMemo(
    () =>
      isMelkDemo
        ? DEMO_MELK_HERO_URL
        : teamPhotoUrl && teamPhotoUrl.length > 0
          ? teamPhotoUrl
          : TEAM_HERO_PLACEHOLDER,
    [teamPhotoUrl, isMelkDemo],
  );
  useEffect(() => {
    if (isDemo || !teamSeasonId) {
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
  }, [teamSeasonId, isDemo]);

  /** Deep-Link / Reload: ?player=p08 oder /demo/players/:id → Profil öffnen. */
  useEffect(() => {
    const pid = (searchParams.get("player") ?? "").trim();
    if (!pid) {
      setSelectedProfilePlayer(null);
      return;
    }
    if (plLoading || players.length === 0) return;
    const match = players.find((p) => p.id === pid);
    if (!match) return;
    setSelectedProfilePlayer((prev) => (prev?.id === match.id ? prev : match));
    setProfileInitialTab("overview");
  }, [searchParams, players, plLoading]);

  const openPlayerProfile = (p: PlayerItem, tab: ProfileTab = "overview") => {
    setSelectedProfilePlayer(p);
    setProfileInitialTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("player", p.id);
    // Team-Tab (z. B. training) beibehalten — nur parents-Tab entfernen
    if (next.get("tab") === "parents") next.delete("tab");
    setSearchParams(next, { replace: false });
  };

  const closePlayerProfile = () => {
    setSelectedProfilePlayer(null);
    setProfileInitialTab("overview");
    if (searchParams.has("player")) {
      const next = new URLSearchParams(searchParams);
      next.delete("player");
      setSearchParams(next, { replace: true });
    }
  };

  const switchPlayerProfile = (player: PlayerItem) => {
    setSelectedProfilePlayer(player);
    const next = new URLSearchParams(searchParams);
    next.set("player", player.id);
    setSearchParams(next, { replace: true });
  };

  const handleTeamPhotoPick = async (file: File) => {
    if (isDemo || !teamSeasonId) return;
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

    if (teamSeasonId) {
      if (isHistoryReadOnly) {
        setFormError(softLockMessage ?? "Archivierte Saison: nur Lesen.");
        setSaving(false);
        return;
      }
      const writable = await assertTeamSeasonWritable(activeTeamSeasonId ?? teamSeasonId);
      if (!writable.ok) {
        setFormError(writable.message);
        setSaving(false);
        return;
      }
    }

    if (mode === "create") {
      if (activeTeamSeasonId == null) {
        setFormError("Keine Mannschaftssaison ausgewählt.");
        setSaving(false);
        return;
      }
      const { playerId: newPlayerId, error: createError } = await createRosterPlayer({
        teamSeasonId: activeTeamSeasonId,
        firstName: first_name.trim(),
        lastName: last_name.trim(),
        jerseyNumber: form.jersey_number ? Number(form.jersey_number) : null,
        position: form.position?.trim() || null,
        birthdateIso: form.birthdate ? toISODate(form.birthdate) : null,
      });
      if (createError) {
        setFormError(
          isJerseyDuplicateError({ message: createError })
            ? `Nummer ${jersey ?? ""} ist bereits vergeben. Bitte eine andere Nummer wählen.`
            : createError,
        );
        setSaving(false);
        if (newPlayerId) await refetchPlayers();
        return;
      }
      if (!newPlayerId) {
        setFormError("Spieler angelegt, aber Spieler-ID fehlt – Geburtsdatum bitte später bearbeiten.");
        setSaving(false);
        await refetchPlayers();
        closeForm();
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
      const { error: updateError } = await (async () => {
        const res = await updateRosterPlayerSeasonFields({
          playerId: editingPlayer.id,
          teamSeasonId,
          firstName: first_name.trim(),
          lastName: last_name.trim(),
          jerseyNumber: form.jersey_number ? Number(form.jersey_number) : null,
          position: form.position?.trim() || null,
        });
        return { error: res.ok ? null : { message: res.error ?? "Speichern fehlgeschlagen." } };
      })();
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
    if (!teamSeasonId) {
      setFormError("Keine Mannschaftssaison ausgewählt.");
      return;
    }
    setDeletingId(playerId);
    const { ok, error } = await updateRosterPlayerSeasonFields({
      playerId,
      teamSeasonId,
      status: nextStatus,
      isActive: nextStatus === "active",
    });
    setDeletingId(null);
    if (!ok) {
      setFormError(error ?? "Status konnte nicht geändert werden.");
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
    const next = new URLSearchParams(searchParams);
    next.delete("player");
    if (tabId === "squad") next.delete("tab");
    else next.set("tab", tabId);
    setSearchParams(next, { replace: true });
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
  const { myAttendancePlayerIds } = useAvailabilityPermissions({
    role: roleNormalized,
    teamSeasonId,
    viewOnlyPlayer: false,
  });
  const ownPlayerIds = useMemo(() => {
    if (isDemo) return new Set(["p08"]);
    return new Set(myAttendancePlayerIds);
  }, [isDemo, myAttendancePlayerIds]);
  const showcasePlayers = useMemo(() => {
    const prioritizeOwnPlayers = isDemo || roleNormalized === "parent" || roleNormalized === "player";
    if (!prioritizeOwnPlayers) return sortedPlayers;
    const own = new Set(ownPlayerIds);
    return [...sortedPlayers].sort((a, b) => {
      const aOwn = own.has(a.id) ? 1 : 0;
      const bOwn = own.has(b.id) ? 1 : 0;
      return bOwn - aOwn;
    });
  }, [sortedPlayers, ownPlayerIds, isDemo, roleNormalized]);

  if (searchParams.get("tab") === "parents") {
    return <Navigate to={isDemo ? `${basePath}/team` : "/app/mehr/parent-access"} replace />;
  }

  return (
    <>
    {selectedProfilePlayer ? (
      <PlayerProfileModal
        player={selectedProfilePlayer}
        role={role}
        teamSeasonId={teamSeasonId}
        teamSeasonLabel={teamLabel}
        teamName={heroTeamName}
        teamLogoUrl={isMelkDemo ? DEMO_MELK_LOGO_URL : undefined}
        photoUrl={readOptionalPhotoUrl(selectedProfilePlayer)}
        canManage={canManagePlayers}
        initialTab={profileInitialTab}
        squadPlayers={players}
        profilePlayers={showcasePlayers}
        onPlayerChange={switchPlayerProfile}
        onNextAfterLast={staffRows[0] ? () => {
          closePlayerProfile();
          navigate(`${basePath}/team/trainer/${encodeURIComponent(staffRows[0].user_id)}`);
        } : undefined}
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
      className="page team-page min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-0 pb-36 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-none space-y-3 md:max-w-3xl lg:max-w-4xl"
    >
      {isDemo ? (
        <div className="mx-3 rounded-2xl border border-white/10 bg-black/55 p-3 sm:mx-0" data-testid="demo-club-preview-switcher">
          <label className="flex items-center justify-between gap-3 text-[12px] font-semibold text-white/75">
            <span>Demo-Verein</span>
            <select
              value={isMelkDemo ? DEMO_MELK_QUERY_VALUE : "rohrbach"}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value === DEMO_MELK_QUERY_VALUE) next.set("club", DEMO_MELK_QUERY_VALUE);
                else next.delete("club");
                next.set("tab", "squad");
                setSearchParams(next, { replace: true });
              }}
              className={`min-h-10 rounded-xl border bg-black/70 px-3 text-[13px] font-bold text-white outline-none ${
                isMelkDemo ? "border-blue-400/55 focus:ring-2 focus:ring-yellow-400/35" : "border-red-500/35 focus:ring-2 focus:ring-red-500/35"
              }`}
              aria-label="Verein für Demo-Vorschau auswählen"
            >
              <option value="rohrbach">SPG Rohrbach U12</option>
              <option value={DEMO_MELK_QUERY_VALUE}>SC Melk Frauen</option>
            </select>
          </label>
        </div>
      ) : null}
      {/* Team Hero */}
      <PremiumCard matchday showAmbientGlow className="!rounded-none !border-x-0 !p-0 overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.5)] sm:!rounded-3xl sm:!border-x">
      <div className="relative h-[220px] sm:h-auto sm:aspect-[16/9] sm:min-h-[280px] sm:max-h-[390px]">
        <img
          src={heroPhotoSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.18)_38%,rgba(0,0,0,0.94)_100%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.48)_0%,transparent_62%)]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14] bg-[repeating-linear-gradient(90deg,transparent,transparent_14px,rgba(255,255,255,0.04)_14px,rgba(255,255,255,0.04)_16px)]"
          aria-hidden
        />
        <div className={`pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl ${isMelkDemo ? "bg-blue-600/30" : "bg-red-600/20"}`} aria-hidden />
        <div className="relative z-10 flex h-full min-h-[220px] flex-col justify-end p-4 sm:min-h-[280px] sm:p-6">
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
                disabled={teamPhotoUploading || !activeTeamSeasonId || isHistoryReadOnly}
                onClick={() => {
                  if (isHistoryReadOnly) {
                    window.alert(softLockMessage ?? "Archivierte Saison: nur Lesen.");
                    return;
                  }
                  teamPhotoInputRef.current?.click();
                }}
                title={isHistoryReadOnly ? softLockMessage ?? "Archiv: nur Lesen" : "Mannschaftsfoto"}
                className="h-9 gap-1 px-2.5 backdrop-blur-sm hover:border-red-400/40 hover:bg-black/60 sm:h-8"
              >
                <Camera className="h-4 w-4 shrink-0 text-red-300/95" aria-hidden />
                <span className="text-[11px] font-medium text-white/85">Foto</span>
              </AppButton>
            </div>
          ) : null}
          <div className="flex items-end gap-3 sm:gap-4">
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center sm:h-[82px] sm:w-[82px]">
              <img
                src={isMelkDemo ? DEMO_MELK_LOGO_URL : getOurTeamLogoUrl()}
                alt={isMelkDemo ? "SC Melk Wappen" : "SPG Rohrbach Wappen"}
                className="h-full w-full object-contain drop-shadow-[0_5px_16px_rgba(0,0,0,0.75)]"
              />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-[27px] font-black uppercase leading-none tracking-tight text-white drop-shadow-lg sm:text-[34px]">
                {tsLoading ? "Lade Team…" : isMelkDemo ? DEMO_MELK_TEAM_NAME : getOurTeamDisplayName()}
              </p>
              <p className="mt-2 text-[13px] font-black uppercase tracking-[0.1em] text-white/78 sm:text-[15px]">
                <span className={isMelkDemo ? "text-yellow-400" : "text-red-400"}>{heroAgeGroup}</span> · Saison {heroSeason}
                {isHistoryReadOnly ? " · Archiv" : ""}
              </p>
            </div>
          </div>
          <div>
            {!isDemo && teamSeasons.length > 1 ? (
              <label className="mt-3 hidden min-w-0 pl-[80px] sm:block sm:pl-[98px]">
                <span className="sr-only">Saison anzeigen</span>
                <select
                  value={readTeamSeasonId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    if (!id) {
                      setViewTeamSeasonId(null);
                      return;
                    }
                    const ts = teamSeasons.find((row) => row.id === id);
                    if (!ts) return;
                    const action = resolveTeamSeasonSwitcherAction(ts.status);
                    if (action === "select-work") {
                      setSelectedTeamSeasonId(id);
                      return;
                    }
                    setViewTeamSeasonId(id);
                  }}
                  className="w-full max-w-full rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-xs text-white/90 sm:text-sm"
                  aria-label="Saison für Mannschaft wählen"
                >
                  {teamSeasons.map((ts) => (
                    <option key={ts.id} value={ts.id}>
                      {formatTeamSeasonCompactSwitcherLabel(
                        {
                          displayName: ts.display_name,
                          ageGroup: ts.age_group,
                          teamName: ts.team?.name,
                          seasonName: ts.season?.name,
                          status: ts.status,
                        },
                        {
                          markArchived: true,
                          markCurrent: ts.id === activeTeamSeasonId,
                        },
                      )}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              null
            )}
          </div>
          {isHistoryReadOnly ? (
            <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-100/95">
              {softLockMessage ?? "Archivierte Saison — nur Lesen. Aktive Saison bleibt unverändert."}
            </p>
          ) : null}
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
        className="sticky top-0 z-20 mx-3 !p-1 backdrop-blur-md sm:mx-0"
      >
        {tabsReady ? (
          <PremiumTabTrack className="min-w-0">
            {TEAM_TABS.map((tab) => (
              <PremiumTab
                key={tab.id}
                kind="filter"
                active={activeTab === tab.id}
                onClick={() => handleTeamTabChange(tab.id)}
                className={`min-w-0 px-1.5 text-[10px] sm:px-2.5 sm:text-[12px] ${
                  isMelkDemo && activeTab === tab.id ? "demo-melk-active-tab" : ""
                }`}
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

      {isMelkDemo ? (
        <p className="mx-3 mt-3 rounded-xl border border-blue-400/25 bg-blue-950/25 px-3 py-2 text-[11px] leading-relaxed text-blue-100/80 sm:mx-0">
          Personalisierte Präsentationsdemo: Mannschaftsfoto und Wappen nach der öffentlichen SC-Melk-Webseite; Profilnamen und Einzelporträts sind fiktive Demo-Inhalte.
        </p>
      ) : isDemo ? <DemoAiDisclosure className="mt-3" /> : null}

      {activeTab === "squad" ? (
      <PremiumCard variant="subtle" showAmbientGlow={false} className="!rounded-none !border-0 !bg-transparent !p-0 !shadow-none sm:!rounded-3xl sm:!border sm:!bg-inherit sm:!p-5">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-0">
          <SectionTitle as="h2" className="[&>h2]:text-xl [&>h2]:font-black [&>h2]:uppercase [&>h2]:tracking-tight">
            Unser Team
          </SectionTitle>
          <div className="flex items-center gap-2">
            {!plLoading && canManagePlayers ? (
              <select
                value={squadFilter}
                onChange={(event) => setSquadFilter(event.target.value as typeof squadFilter)}
                className="h-9 min-w-0 max-w-[112px] rounded-full border border-white/10 bg-white/[0.06] px-2.5 text-[11px] font-black text-white/80 outline-none"
                aria-label="Kader filtern"
              >
                <option value="active">Aktiv ({activeCount})</option>
                <option value="paused">Pausiert ({pausedCount})</option>
                <option value="all">Alle ({players.length})</option>
              </select>
            ) : !plLoading ? (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-white/75">
                {showcasePlayers.length} Spieler
              </span>
            ) : null}
            {teamSeasonId != null && canManagePlayers && !plLoading ? (
              <PremiumButton type="button" variant="interactive" onClick={() => openCreateForm()} className="!min-h-[36px] shrink-0 !px-2.5 !py-1.5 !text-xs">
                + Spieler
              </PremiumButton>
            ) : null}
          </div>
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
              <TeamSquadShowcase
                players={showcasePlayers}
                ownPlayerIds={ownPlayerIds}
                onPlayerClick={openPlayerProfile}
                onSwipePastEnd={() => handleTeamTabChange("trainers")}
                clubTheme={isMelkDemo ? "melk" : "default"}
              />
            </>
          )}
        </div>
      </PremiumCard>
      ) : null}

      {activeTab === "trainers" ? (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle as="h2" className="[&>h2]:text-xl [&>h2]:font-black [&>h2]:uppercase [&>h2]:tracking-tight">
              Unsere Trainer
            </SectionTitle>
            {teamSeasonId != null && canManagePlayers && !isDemo && !staffLoading ? (
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
              <TeamTrainerShowcase
                trainers={staffRows}
                onSwipePastStart={() => handleTeamTabChange("squad")}
                onTrainerClick={(row) =>
                  navigate(`${basePath}/team/trainer/${encodeURIComponent(row.user_id)}`)
                }
              />
            </>
          )}
        </PremiumCard>
      ) : null}

      {activeTab === "training" ? (
        <>
          {returnToTrainingEvent ? (
            <button
              type="button"
              onClick={() => navigate(returnToTrainingEvent)}
              className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-[13px] font-bold text-red-100 transition-colors hover:bg-red-500/15"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Zurück zum Trainingstermin
            </button>
          ) : null}

          {teamSeasonId == null && !tsLoading ? (
            <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
              <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="py-6" />
            </PremiumCard>
          ) : canViewTrainingKaiser && teamSeasonId != null ? (
            <TeamTrainingDashboard
              players={trainingRosterPlayers}
              teamSeasonId={teamSeasonId}
              squadMode="active_only"
              onPlayerClick={(player) => {
                openPlayerProfile(player, "training");
              }}
            />
          ) : teamSeasonId != null ? (
            <TeamTrainingPublicOverview
              players={trainingRosterPlayers}
              teamSeasonId={teamSeasonId}
              squadMode="active_only"
            />
          ) : null}
        </>
      ) : null}

      {activeTab === "matches" ? (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-5">
          <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
            Spiele
          </SectionTitle>
          {teamSeasonId == null && !tsLoading ? (
            <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="mt-3 py-6" />
          ) : (
            <div className="mt-4 space-y-4">
              <SeasonMatchSummaryCard summary={seasonMatchSummary} loading={seasonMatchesLoading} />

              {seasonMatchesError ? (
                <p className="text-center text-[11px] text-amber-400/95">{seasonMatchesError}</p>
              ) : null}

              {upcomingMatches.length > 0 ? (
                <div>
                  <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
                    Nächstes Spiel
                  </p>
                  <SeasonMatchCard match={upcomingMatches[0]} ourTeamName={heroTeamName} />
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
                  Letzte Spiele
                </p>
                {seasonMatchesLoading ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div
                        key={`match-skel-${i}`}
                        className="h-16 animate-pulse rounded-2xl border border-white/5 bg-white/[0.07]"
                      />
                    ))}
                  </div>
                ) : recentSeasonMatches.length === 0 ? (
                  <PremiumEmptyState
                    variant="subtle"
                    title={
                      allSeasonMatches.length > 0
                        ? "Noch keine abgeschlossenen Spiele"
                        : "Noch keine gültigen Spiele erfasst."
                    }
                    className="py-6"
                  />
                ) : (
                  <ul className="space-y-2.5">
                    {recentSeasonMatches.map((m) => (
                      <li key={m.id}>
                        <SeasonMatchCard match={m} ourTeamName={heroTeamName} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </PremiumCard>
      ) : null}
    </PageShell>
    </>
  );
};
