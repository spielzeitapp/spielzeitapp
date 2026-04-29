import React, { useMemo, useState } from "react";
import { useSession } from "../auth/useSession";
import { Button } from "../app/components/ui/Button";
import { Trash2 } from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { usePlayers, type PlayerItem } from "../hooks/usePlayers";
import { roleLabel } from "../utils/roleLabel";
import { normalizeRole, canManageRoster } from "../lib/roles";
import { supabase } from "../lib/supabaseClient";
import { PlayerCard } from "../components/team/PlayerCard";
import { getClubLogo } from "../lib/teamLogos";

type MainTabId = "squad" | "trainer" | "matches";

type FormState = {
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: string;
};

function abbreviatePositionLabel(pos: string | null | undefined): string {
  const raw = (pos ?? "").trim();
  if (!raw) return "—";
  const p = raw.toLowerCase().replaceAll("ü", "u").replaceAll("ß", "ss");
  if (p.includes("tor") || p.includes("torhueter") || p === "torhuter") return "TW";
  if (p.includes("verteid")) return "VT";
  if (p.includes("mittelfeld") || p.includes("mitte")) return "MF";
  if (p.includes("stuer") || p.includes("stuermer") || p.includes("sturmer")) return "ST";
  return raw;
}

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  jersey_number: "",
  position: "",
};

function parseJersey(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isJerseyDuplicateError(err: { code?: string; message?: string }): boolean {
  return err.code === "23505" || (err.message ?? "").includes("players_unique_jersey_per_teamseason");
}

function readOptionalPhotoUrl(p: PlayerItem): string | null {
  const raw = (p as unknown as { photo_url?: unknown }).photo_url;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  return s.length > 0 ? s : null;
}

function isLikelyPhotoUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith("/")) return true;
  return u.startsWith("http://") || u.startsWith("https://");
}

export const TeamPage: React.FC = () => {
  const { selectedTeamSeason } = useSession();
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

  const [mainTab, setMainTab] = useState<MainTabId>("squad");
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState<string>(() =>
    getClubLogo((selectedTeamSeason?.team?.name ?? "").trim() || "SPG Rohrbach"),
  );

  const teamDisplayName = useMemo(() => {
    const n = (selectedTeamSeason?.team?.name ?? "").trim();
    if (n) return n;
    const fromLabel = (teamLabel ?? "").replace(/\s*\([^)]+\)\s*$/, "").trim();
    return fromLabel || "U11 SPG Rohrbach";
  }, [selectedTeamSeason?.team?.name, teamLabel]);

  const seasonDisplay = useMemo(() => {
    const s = (selectedTeamSeason?.season?.name ?? "").trim();
    return s || "Saison 2025/26";
  }, [selectedTeamSeason?.season?.name]);

  React.useEffect(() => {
    setLogoSrc(getClubLogo(teamDisplayName));
  }, [teamDisplayName]);

  const closeForm = () => {
    setShowForm(false);
    setMode("create");
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
  };

  const openCreateForm = () => {
    setForm(emptyForm);
    setMode("create");
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (p: PlayerItem) => {
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      jersey_number: p.jersey_number != null ? String(p.jersey_number) : "",
      position: p.position ?? "",
    });
    setMode("edit");
    setEditingId(p.id);
    setFormError(null);
    setShowForm(true);
  };

  const parsedJerseyNumber = parseJersey(form.jersey_number);
  const isJerseyTaken = (jersey: number | null): boolean => {
    if (jersey == null) return false;
    return players.some(
      (p) => p.jersey_number != null && p.jersey_number === jersey && p.id !== editingId,
    );
  };
  const jerseyTaken = isJerseyTaken(parsedJerseyNumber);
  const jerseyErrorMsg =
    jerseyTaken && parsedJerseyNumber != null ? `Nummer ${parsedJerseyNumber} ist bereits vergeben.` : null;

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
        is_active: true,
      });
      if (insertError) {
        setFormError(
          isJerseyDuplicateError(insertError as { code?: string; message?: string })
            ? `Nummer ${jersey ?? ""} ist bereits vergeben. Bitte eine andere Nummer wählen.`
            : insertError.message,
        );
        setSaving(false);
        return;
      }
    } else {
      if (editingId == null) {
        setSaving(false);
        return;
      }
      const { error: updateError } = await supabase
        .from("players")
        .update({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          jersey_number: jersey,
          position: positionVal,
        })
        .eq("id", editingId);
      if (updateError) {
        setFormError(
          isJerseyDuplicateError(updateError as { code?: string; message?: string })
            ? `Nummer ${jersey ?? ""} ist bereits vergeben. Bitte eine andere Nummer wählen.`
            : updateError.message,
        );
        setSaving(false);
        return;
      }
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

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const ja = a.jersey_number ?? 9999;
      const jb = b.jersey_number ?? 9999;
      if (ja !== jb) return ja - jb;
      return a.display_name.localeCompare(b.display_name, "de");
    });
  }, [players]);

  const mainTabs: { id: MainTabId; label: string }[] = [
    { id: "squad", label: "Kader" },
    { id: "trainer", label: "Trainer" },
    { id: "matches", label: "Spiele" },
  ];

  const handlePlayerCardClick = (p: PlayerItem) => {
    if (canManagePlayers) {
      openEditForm(p);
      return;
    }
    // TODO: Spielerprofil-Route (z. B. /app/spieler/:id) wenn verfügbar
  };

  return (
    <>
      <div className="min-h-[100dvh] bg-[#0a0a0a] text-white">
        <div className="mx-auto w-full max-w-lg px-3 pb-32 pt-3 sm:max-w-xl md:max-w-2xl">
          <h1 className="mb-3 text-xl font-bold tracking-tight text-white">Team</h1>

          {/* Premium Team-Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-black/85 p-4 shadow-[0_0_28px_rgba(239,68,68,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 p-1 shadow-[0_0_16px_rgba(239,68,68,0.12)]">
                <img
                  src={logoSrc}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={() => {
                    if (logoSrc !== "/logos/placeholder-shield-a.png") {
                      setLogoSrc("/logos/placeholder-shield-a.png");
                    }
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold leading-tight text-white">
                  {tsLoading ? "Lade Team…" : teamDisplayName}
                </p>
                <p className="mt-0.5 text-xs font-medium text-white/50">{seasonDisplay}</p>
                <p className="mt-1.5 text-xs font-semibold text-red-400/95">Rolle: {roleLabel(role)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-black tabular-nums leading-none text-white">{players.length}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Spieler</p>
              </div>
            </div>
            {tsError && (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {tsError}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 rounded-2xl border border-white/[0.08] bg-black/45 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {mainTabs.map((t) => {
              const active = mainTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMainTab(t.id)}
                  className={[
                    "min-h-[40px] flex-1 rounded-xl px-2 py-2 text-center text-xs font-bold transition-all duration-200 sm:text-sm",
                    active
                      ? "border border-red-500/35 bg-gradient-to-b from-red-600/35 to-red-900/25 text-white shadow-[0_0_18px_rgba(239,68,68,0.22)]"
                      : "border border-transparent text-white/55 hover:text-white/85",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Kader */}
          {mainTab === "squad" && (
            <section className="mt-5 space-y-3">
              {teamSeasonId == null && !tsLoading && (
                <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-center text-sm text-white/50">
                  Bitte Team wählen.
                </p>
              )}
              {teamSeasonId != null && plLoading && (
                <p className="text-sm text-white/45">Lade Kader…</p>
              )}
              {teamSeasonId != null && !plLoading && plError && (
                <p className="text-sm text-red-400" role="alert">
                  {plError}
                </p>
              )}
              {formError && !showForm && (
                <p className="text-sm text-red-400" role="alert">
                  {formError}
                </p>
              )}
              {teamSeasonId != null && !plLoading && !plError && players.length === 0 && (
                <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-sm text-white/50">
                  Noch keine Spieler angelegt.
                </p>
              )}
              {teamSeasonId != null && !plLoading && !plError && players.length > 0 && (
                <ul className="space-y-2.5">
                  {sortedPlayers.map((p) => {
                    const photoUrl = readOptionalPhotoUrl(p);
                    return (
                      <li key={p.id}>
                        <PlayerCard
                          player={{
                            id: p.id,
                            first_name: p.first_name,
                            last_name: p.last_name,
                            display_name: p.display_name,
                            position: abbreviatePositionLabel(p.position),
                            number: p.jersey_number,
                            photo_url: photoUrl,
                          }}
                          showPhoto={Boolean(photoUrl && isLikelyPhotoUrl(photoUrl))}
                          onClick={() => handlePlayerCardClick(p)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {mainTab === "trainer" && (
            <section className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-10 text-center">
              <p className="text-sm font-medium text-white/55">Trainer-Bereich</p>
              <p className="mt-2 text-xs text-white/40">Demnächst mehr Infos zum Trainerteam.</p>
            </section>
          )}

          {mainTab === "matches" && (
            <section className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-10 text-center">
              <p className="text-sm font-medium text-white/55">Spiele</p>
              <p className="mt-2 text-xs text-white/40">Übersicht der Team-Spiele folgt.</p>
            </section>
          )}
        </div>
      </div>

      {/* Spieler-Formular nur als Overlay (nicht dauerhaft in der Liste) */}
      {showForm && canManagePlayers && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/[0.1] bg-zinc-900 px-4 pb-8 pt-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
            <h2 className="text-center text-lg font-bold text-white">
              {mode === "create" ? "Spieler anlegen" : "Spieler bearbeiten"}
            </h2>
            {formError && (
              <p className="mt-2 text-center text-sm text-red-400" role="alert">
                {formError}
              </p>
            )}
            <form onSubmit={handleFormSubmit} className="mt-4 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-white/50">Vorname *</span>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  required
                  className="min-h-[44px] rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-white/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  disabled={saving}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-white/50">Nachname *</span>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  required
                  className="min-h-[44px] rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-white/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  disabled={saving}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-white/50">Nummer</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={form.jersey_number}
                  onChange={(e) => setForm((f) => ({ ...f, jersey_number: e.target.value }))}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  disabled={saving}
                />
                {jerseyErrorMsg && (
                  <span className="text-xs text-red-400" role="alert">
                    {jerseyErrorMsg}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-white/50">Position</span>
                <input
                  type="text"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="z. B. ST"
                  className="min-h-[44px] rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                  disabled={saving}
                />
              </label>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button type="submit" disabled={saving || !form.first_name.trim() || jerseyTaken} className="min-h-[48px] flex-1">
                  {saving ? "Speichern…" : "Speichern"}
                </Button>
                <Button type="button" variant="ghost" onClick={closeForm} disabled={saving} className="min-h-[48px] flex-1">
                  Abbrechen
                </Button>
              </div>
              {mode === "edit" && editingId && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleRemove(editingId)}
                    disabled={deletingId !== null || saving}
                    className="text-red-400 hover:bg-red-950/40 hover:text-red-300"
                    aria-label="Spieler entfernen"
                  >
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                    Spieler entfernen
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {teamSeasonId != null && canManagePlayers && !plLoading ? (
        <button
          type="button"
          onClick={openCreateForm}
          className="fixed bottom-24 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-2xl font-bold text-white shadow-[0_4px_24px_rgba(239,68,68,0.45)] transition-transform hover:scale-105 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] active:scale-95 md:bottom-24 md:right-8"
          aria-label="Spieler hinzufügen"
        >
          +
        </button>
      ) : null}
    </>
  );
};
