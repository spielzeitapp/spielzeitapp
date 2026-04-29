import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession, getTeamNameFromMembership, getSeasonLabelFromMembership } from "../auth/useSession";
import { Card, CardTitle } from "../app/components/ui/Card";
import { Tabs, TabOption } from "../app/components/ui/Tabs";
import { Button } from "../app/components/ui/Button";
import { Trash2 } from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { usePlayers, type PlayerItem } from "../hooks/usePlayers";
import { normalizeRole, canManageRoster, ROLE_LABELS_DE } from "../lib/roles";
import { supabase } from "../lib/supabaseClient";
import { PlayerCard } from "../components/team/PlayerCard";
import { PlayerProfileModal } from "../components/team/PlayerProfileModal";

type TeamTabId = "squad" | "trainers" | "matches";

type StaffMembershipRow = {
  user_id: string;
  role: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
};

type RecentMatchRow = {
  id: string;
  opponent: string | null;
  match_date: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
};

type FormState = {
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: string;
  /** `YYYY-MM-DD` fürs Datumsfeld; leer = kein Geburtsdatum */
  birthdate: string;
};

function abbreviatePositionLabel(pos: string | null | undefined): string {
  const raw = (pos ?? '').trim();
  if (!raw) return "—";
  const p = raw.toLowerCase().replaceAll('ü', 'u').replaceAll('ß', 'ss');
  if (p.includes('tor') || p.includes('torhueter') || p === 'torhuter') return 'TW';
  if (p.includes('verteid')) return 'VT';
  if (p.includes('mittelfeld') || p.includes('mitte')) return 'MF';
  if (p.includes('stuer') || p.includes('stuermer') || p.includes('sturmer')) return 'ST';
  return raw;
}

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  jersey_number: "",
  position: "",
  birthdate: "",
};

function formBirthdateToDb(value: string): string | null {
  const t = value.trim();
  return t.length > 0 ? t.slice(0, 10) : null;
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

function staffRoleLabelDe(rawRole: string): string {
  const s = rawRole.trim().toLowerCase();
  if (s === "head_coach") return ROLE_LABELS_DE.head_coach;
  if (s === "co_trainer") return ROLE_LABELS_DE.co_trainer;
  if (s === "trainer") return ROLE_LABELS_DE.trainer;
  return ROLE_LABELS_DE.trainer;
}

function profileDisplayName(p: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!p) return "—";
  const a = (p.first_name ?? "").trim();
  const b = (p.last_name ?? "").trim();
  const full = [a, b].filter(Boolean).join(" ").trim();
  return full || "—";
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

export const TeamPage: React.FC = () => {
  const { selectedTeamSeason, selectedMembership } = useSession();
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
  } = usePlayers(teamSeasonId);

  const roleNormalized = normalizeRole(role);
  const canManagePlayers = canManageRoster(roleNormalized);

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<PlayerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<PlayerItem | null>(null);
  const [staffRows, setStaffRows] = useState<StaffMembershipRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatchRow[]>([]);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!teamSeasonId) {
      setStaffRows([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("memberships")
      .select("user_id, role, profiles(first_name, last_name)")
      .eq("team_season_id", teamSeasonId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStaffRows([]);
          return;
        }
        const rows = (data ?? []) as StaffMembershipRow[];
        const staff = rows.filter((r) => {
          const s = (r.role ?? "").trim().toLowerCase();
          return s === "trainer" || s === "co_trainer" || s === "head_coach";
        });
        setStaffRows(staff);
      });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

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

  const clearAvatarLocalPreview = () => {
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    setAvatarObjectUrl(null);
    setAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const closeForm = () => {
    setShowForm(false);
    setMode("create");
    setForm(emptyForm);
    setEditingId(null);
    setEditingPlayer(null);
    setAvatarPreviewUrl(null);
    clearAvatarLocalPreview();
    setFormError(null);
  };

  const openCreateForm = () => {
    setForm(emptyForm);
    setMode("create");
    setEditingId(null);
    setEditingPlayer(null);
    setAvatarPreviewUrl(null);
    clearAvatarLocalPreview();
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (p: PlayerItem) => {
    const bd = (p.birthdate ?? "").trim();
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      jersey_number: p.jersey_number != null ? String(p.jersey_number) : "",
      position: p.position ?? "",
      birthdate: bd.length >= 10 ? bd.slice(0, 10) : bd,
    });
    setMode("edit");
    setEditingId(p.id);
    setEditingPlayer(p);
    setAvatarPreviewUrl(readOptionalPhotoUrl(p));
    clearAvatarLocalPreview();
    setFormError(null);
    setShowForm(true);
  };

  const openPlayerProfile = (p: PlayerItem) => {
    setSelectedProfilePlayer(p);
  };

  const closePlayerProfile = () => {
    setSelectedProfilePlayer(null);
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
    };
  }, [avatarObjectUrl]);

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
    const { first_name, last_name, position } = form;
    if (!first_name.trim()) return;
    if (jerseyTaken) {
      setFormError(jerseyErrorMsg ?? "Diese Nummer ist bereits vergeben.");
      return;
    }
    setFormError(null);
    setSaving(true);
    const jersey = parsedJerseyNumber;
    const positionVal = position.trim() || null;
    const birthdateVal = formBirthdateToDb(form.birthdate);

    if (mode === "create") {
      if (teamSeasonId == null) {
        setFormError("Keine Mannschaftssaison ausgewählt.");
        setSaving(false);
        return;
      }
      const { error: insertError } = await supabase.from("players").insert({
        team_season_id: teamSeasonId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        jersey_number: jersey,
        position: positionVal,
        birthdate: birthdateVal,
        is_active: true,
      });
      if (insertError) {
        setFormError(
          isJerseyDuplicateError(insertError as { code?: string; message?: string })
            ? `Nummer ${jersey ?? ""} ist bereits vergeben. Bitte eine andere Nummer wählen.`
            : insertError.message
        );
        setSaving(false);
        return;
      }
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
      if (avatarFile) {
        setAvatarUploading(true);
        const ext = avatarFile.type === "image/png" ? "png" : avatarFile.type === "image/webp" ? "webp" : "jpg";
        const uploadPath = `${teamSeasonId}/${editingPlayer.id}.${ext}`;
        console.log("editingPlayer for avatar save", editingPlayer);
        console.log("avatar update player id", editingPlayer.id);
        console.log("[AvatarUpload] editingPlayer.id:", editingPlayer.id);
        console.log("[AvatarUpload] teamSeasonId:", teamSeasonId);
        console.log("[AvatarUpload] uploadPath:", uploadPath);
        const { error: uploadError } = await supabase.storage
          .from("player-avatars")
          .upload(uploadPath, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) {
          setAvatarUploading(false);
          setSaving(false);
          setFormError(
            `Foto-Upload fehlgeschlagen: ${uploadError.message}. Bitte Storage-Policy/Bucket prüfen.`
          );
          return;
        }
        const { data: publicData } = supabase.storage
          .from("player-avatars")
          .getPublicUrl(uploadPath);

        const publicUrl = publicData?.publicUrl ?? null;
        console.log("[AvatarUpload] publicUrl:", publicUrl);

        const { data: updatedPlayer, error: avatarUpdateError } = await supabase
          .from("player_avatars")
          .upsert(
            {
              player_id: editingPlayer.id,
              avatar_url: publicUrl,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "player_id" }
          )
          .select("*")
          .maybeSingle();
        console.log("editingPlayer.id", editingPlayer.id);
        console.log("updatedPlayer", updatedPlayer);
        console.log("[AvatarUpload] update result:", updatedPlayer ?? null);
        console.log("[AvatarUpload] update error:", avatarUpdateError ?? null);
        if (avatarUpdateError) {
          console.error("avatar_url update failed", avatarUpdateError);
          setAvatarUploading(false);
          setSaving(false);
          setFormError(`Avatar gespeichert, aber URL nicht gesetzt: ${avatarUpdateError.message}`);
          return;
        }
        if (updatedPlayer == null) {
          setAvatarUploading(false);
          setSaving(false);
          setFormError("Avatar URL konnte nicht gespeichert werden – Player nicht gefunden");
          return;
        }
        console.log("[AvatarSave] saved to player_avatars.avatar_url", publicUrl);
        nextAvatarUrl =
          (updatedPlayer?.avatar_url as string | null | undefined) ??
          publicUrl;
      }
      const { error: updateError } = await supabase
        .from("players")
        .update({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          jersey_number: jersey,
          position: positionVal,
          birthdate: birthdateVal,
        })
        .eq("id", editingPlayer.id);
      setAvatarUploading(false);
      if (updateError) {
        setFormError(
          isJerseyDuplicateError(updateError as { code?: string; message?: string })
            ? `Nummer ${jersey ?? ""} ist bereits vergeben. Bitte eine andere Nummer wählen.`
            : updateError.message
        );
        setSaving(false);
        return;
      }
      if (nextAvatarUrl) setAvatarPreviewUrl(nextAvatarUrl);
    }

    setSaving(false);
    closeForm();
    await refetchPlayers();
  };

  const handleRemove = async (playerId: string) => {
    if (!window.confirm("Spieler wirklich entfernen?")) return;
    setDeletingId(playerId);
    const { error } = await supabase.from("players").update({ is_active: false }).eq("id", playerId);
    setDeletingId(null);
    if (error) {
      setFormError(error.message);
      return;
    }
    if (editingId === playerId) closeForm();
    await refetchPlayers();
  };

  const teamTabs: TabOption[] = [
    { id: "squad", label: "Kader" },
    { id: "trainers", label: "Trainer" },
    { id: "matches", label: "Spiele" },
  ];

  const [activeTab, setActiveTab] = useState<TeamTabId>("squad");

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const ja = a.jersey_number ?? 9999;
      const jb = b.jersey_number ?? 9999;
      if (ja !== jb) return ja - jb;
      return a.display_name.localeCompare(b.display_name, "de");
    });
  }, [players]);

  return (
    <>
    {selectedProfilePlayer ? (
      <PlayerProfileModal
        player={selectedProfilePlayer}
        teamSeasonLabel={teamLabel}
        positionAbbrev={abbreviatePositionLabel(selectedProfilePlayer.position)}
        photoUrl={readOptionalPhotoUrl(selectedProfilePlayer)}
        canManage={canManagePlayers}
        onClose={closePlayerProfile}
        onEdit={handleEditFromProfile}
      />
    ) : null}
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-36 lg:max-w-6xl">
      {/* Team Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-[#111] shadow-[0_12px_48px_rgba(0,0,0,0.5)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(48,10,10,0.96)_0%,rgba(14,14,18,0.98)_45%,rgba(8,8,12,1)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14] bg-[repeating-linear-gradient(90deg,transparent,transparent_14px,rgba(255,255,255,0.04)_14px,rgba(255,255,255,0.04)_16px)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-red-600/20 blur-3xl" aria-hidden />
        <div className="relative flex min-h-[140px] flex-col justify-end p-5 sm:min-h-[152px] sm:p-6">
          <div>
            <p className="text-lg font-bold leading-tight text-white sm:text-xl">
              {tsLoading ? "Lade Team…" : heroTeamName}
            </p>
            <p className="mt-1 text-sm text-white/60">{heroSeason}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70 sm:text-sm">
            <span className="inline-flex items-center gap-1.5 opacity-90">
              <span aria-hidden>👥</span>
              <span>{tsLoading ? "…" : `${players.length} Spieler`}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 opacity-90">
              <span aria-hidden>👤</span>
              <span>
                {trainerCount} Trainer
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 opacity-90">
              <span aria-hidden>📅</span>
              <span>Saison {heroSeason}</span>
            </span>
          </div>
        </div>
      </div>

      {tsError ? (
        <p className="text-sm text-red-600" role="alert">
          {tsError}
        </p>
      ) : null}

      <div className="sticky top-0 z-20 rounded-xl border border-red-500/15 bg-[#111]/90 px-1 shadow-[0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <Tabs
          variant="stadium"
          tabs={teamTabs}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TeamTabId)}
        />
      </div>

      {activeTab === "squad" ? (
      <Card className="rounded-2xl border border-red-500/20 bg-[#111] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="mt-0">Kader</CardTitle>
          {teamSeasonId != null && canManagePlayers && !plLoading ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => (showForm ? closeForm() : openCreateForm())}>
              {showForm ? "Schließen" : "+ Spieler hinzufügen"}
            </Button>
          ) : null}
        </div>
        <div className="mt-2">
          {teamSeasonId == null && !tsLoading && (
            <p className="text-sm text-[var(--muted)]">Bitte Team wählen.</p>
          )}
          {teamSeasonId != null && plLoading && (
            <p className="text-sm text-[var(--muted)]">Lade Kader…</p>
          )}
          {teamSeasonId != null && !plLoading && plError && (
            <p className="text-sm text-red-600" role="alert">
              {plError}
            </p>
          )}
          {formError && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}
          {teamSeasonId != null && showForm && (
            <form onSubmit={handleFormSubmit} className="mb-3 space-y-2 rounded border border-[var(--border)] bg-[var(--bg)]/50 p-3">
              <div className="mb-1 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
                <div className="h-24 w-24 shrink-0">
                  {avatarObjectUrl || avatarPreviewUrl ? (
                    <img
                      src={avatarObjectUrl || avatarPreviewUrl || ""}
                      alt="Avatar Vorschau"
                      className="h-24 w-24 rounded-full border border-white/30 object-cover shadow-[0_0_16px_rgba(239,68,68,0.25)]"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (next) next.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-zinc-800 text-xl font-black text-white/90 shadow-[0_0_16px_rgba(239,68,68,0.18)]"
                    style={{ display: avatarObjectUrl || avatarPreviewUrl ? "none" : "flex" }}
                  >
                    {(form.first_name || form.last_name)
                      ? `${(form.first_name || " ").trim().charAt(0)}${(form.last_name || " ").trim().charAt(0)}`.toUpperCase()
                      : "SP"}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Spielerfoto</p>
                  <p className="text-xs text-white/55">JPG, PNG oder WebP, max. 3 MB</p>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const allowed = ["image/jpeg", "image/png", "image/webp"];
                    if (!allowed.includes(file.type)) {
                      setFormError("Bitte nur JPG, PNG oder WebP hochladen.");
                      return;
                    }
                    if (file.size > 3 * 1024 * 1024) {
                      setFormError("Datei ist zu groß (max. 3 MB).");
                      return;
                    }
                    setFormError(null);
                    clearAvatarLocalPreview();
                    setAvatarFile(file);
                    setAvatarObjectUrl(URL.createObjectURL(file));
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={mode !== "edit" || avatarUploading || saving || !editingId}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarUploading ? "Upload…" : "Foto hochladen"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--muted)]">Vorname *</span>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder="Vorname"
                    required
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    disabled={saving || !canManagePlayers}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--muted)]">Nachname *</span>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    placeholder="Nachname"
                    required
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    disabled={saving || !canManagePlayers}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--muted)]">Nummer</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={form.jersey_number}
                    onChange={(e) => setForm((f) => ({ ...f, jersey_number: e.target.value }))}
                    placeholder="—"
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    disabled={saving || !canManagePlayers}
                  />
                  {jerseyErrorMsg && (
                    <span className="text-sm text-red-600" role="alert">
                      {jerseyErrorMsg}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--muted)]">Position</span>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                    placeholder="z. B. ST"
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    disabled={saving || !canManagePlayers}
                  />
                </label>
                <label className="flex flex-col gap-0.5 sm:min-w-[11rem]">
                  <span className="text-xs text-[var(--muted)]">Geburtsdatum</span>
                  <input
                    type="date"
                    value={form.birthdate}
                    onChange={(e) => setForm((f) => ({ ...f, birthdate: e.target.value }))}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    disabled={saving || !canManagePlayers}
                  />
                </label>
                <span className="flex gap-2">
                  {canManagePlayers && (
                    <Button
                      type="submit"
                      className="bg-red-600 text-white hover:bg-red-500"
                      disabled={saving || avatarUploading || !form.first_name.trim() || jerseyTaken}
                    >
                      {saving ? "Speichern…" : "Speichern"}
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={closeForm} disabled={saving}>
                    Abbrechen
                  </Button>
                </span>
              </div>

              {canManagePlayers && mode === "edit" && editingId && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleRemove(editingId)}
                    disabled={deletingId !== null || saving}
                    className="text-red-400 hover:bg-red-950/40 hover:text-red-300"
                    aria-label="Spieler entfernen"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
            </form>
          )}
          {teamSeasonId != null && !plLoading && !plError && players.length === 0 && !showForm && (
            <p className="text-sm text-[var(--muted)]">
              Noch keine Spieler angelegt.
            </p>
          )}
          {teamSeasonId != null && !plLoading && !plError && players.length > 0 && (
            <ul className="mt-3 space-y-2.5 pb-8">
              {sortedPlayers.map((p) => (
                <li
                  key={p.id}
                  className={
                    canManagePlayers
                      ? "rounded-xl transition-[box-shadow] duration-200 hover:shadow-[0_0_22px_rgba(239,68,68,0.18)]"
                      : undefined
                  }
                >
                  <PlayerCard
                    player={{
                      id: p.id,
                      first_name: p.first_name,
                      last_name: p.last_name,
                      display_name: p.display_name,
                      position: abbreviatePositionLabel(p.position),
                      number: p.jersey_number,
                      photo_url: readOptionalPhotoUrl(p),
                    }}
                    onClick={() => openPlayerProfile(p)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      ) : null}

      {activeTab === "trainers" ? (
        <Card className="rounded-2xl border border-red-500/20 bg-[#111] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-5">
          <CardTitle className="mt-0">Trainer</CardTitle>
          {teamSeasonId == null && !tsLoading ? (
            <p className="mt-3 text-sm text-white/55">Bitte Team wählen.</p>
          ) : staffRows.length === 0 ? (
            <p className="mt-4 text-center text-sm text-white/50">Keine Trainer hinterlegt</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {staffRows.map((row) => (
                <li
                  key={`${row.user_id}-${row.role}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-zinc-800 text-sm font-black text-white/90">
                    {profileDisplayName(row.profiles)
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white">{profileDisplayName(row.profiles)}</div>
                    <div className="mt-0.5 text-xs text-white/55">{staffRoleLabelDe(row.role)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {activeTab === "matches" ? (
        <Card className="rounded-2xl border border-red-500/20 bg-[#111] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-5">
          <CardTitle className="mt-0">Spiele</CardTitle>
          {teamSeasonId == null && !tsLoading ? (
            <p className="mt-3 text-sm text-white/55">Bitte Team wählen.</p>
          ) : recentMatches.length === 0 ? (
            <p className="mt-4 text-center text-sm text-white/50">Keine Spiele vorhanden</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {recentMatches.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-white">{(m.opponent ?? "").trim() || "—"}</span>
                    <span className="tabular-nums text-white/80">{formatMatchResult(m)}</span>
                  </div>
                  <div className="mt-1 text-xs text-white/50">{formatMatchDateDe(m.match_date)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
    </>
  );
};

