import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "../auth/useSession";
import { RequireFeature } from "../auth/rbac";
import { Card, CardTitle } from "../app/components/ui/Card";
import { Tabs, TabOption } from "../app/components/ui/Tabs";
import { Button } from "../app/components/ui/Button";
import { Trash2 } from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { usePlayers, type PlayerItem } from "../hooks/usePlayers";
import { roleLabel } from "../utils/roleLabel";
import { normalizeRole, canManageRoster } from "../lib/roles";
import { supabase } from "../lib/supabaseClient";

type TeamTabId = "overview" | "training" | "squad";

type FormState = {
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: string;
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
};

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

/** Read-only: Rollenverteilung aus memberships (MVP). */
function TeamMembershipRolesCard({ teamSeasonId }: { teamSeasonId: string | null }) {
  const [rows, setRows] = useState<Array<{ role: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamSeasonId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("memberships")
      .select("role")
      .eq("team_season_id", teamSeasonId)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          setRows([]);
          return;
        }
        setRows((data ?? []) as Array<{ role: string }>);
      });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const key = String(r.role ?? "").trim() || "—";
      m[key] = (m[key] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  if (!teamSeasonId) return null;

  return (
    <Card>
      <CardTitle className="mt-0">Team & Rollen</CardTitle>
      <p className="mt-1 text-xs text-[var(--muted)]">Mitgliedschafts-Rollen (Lesen)</p>
      {loading && <p className="mt-2 text-sm text-[var(--muted)]">Laden…</p>}
      {!loading && rows.length === 0 && (
        <p className="mt-2 text-sm text-[var(--muted)]">Keine Einträge.</p>
      )}
      {!loading && rows.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {Object.entries(counts).map(([raw, n]) => {
            const nr = normalizeRole(raw);
            return (
              <li key={raw} className="flex justify-between gap-2 border-b border-[var(--border)]/40 pb-1 last:border-0">
                <span>{roleLabel(nr || raw)}</span>
                <span className="text-[var(--muted)]">{n}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export const TeamPage: React.FC = () => {
  const { canAccess } = useSession();
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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
            : insertError.message
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
            : updateError.message
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

  const allTabs: TabOption[] = [
    { id: "overview", label: "Übersicht" },
    { id: "training", label: "Training" },
    { id: "squad", label: "Kader" },
  ];

  const visibleTabs = allTabs.filter((tab) => {
    if (tab.id === "training") {
      return canAccess("training");
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<TeamTabId>(
    (visibleTabs[0]?.id as TeamTabId) ?? "overview",
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const ja = a.jersey_number ?? 9999;
      const jb = b.jersey_number ?? 9999;
      if (ja !== jb) return ja - jb;
      return a.display_name.localeCompare(b.display_name, "de");
    });
  }, [players]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3 pb-24 lg:max-w-6xl">
      <h1 className="text-xl font-semibold">Team</h1>

      <div className="lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-5">
        <div className="space-y-3">
      {/* Team Card */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="mt-0">
              {tsLoading ? "Lade Team…" : (teamLabel ?? "Team")}
            </CardTitle>
            {!tsLoading && (
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {roleLabel(role)}
              </p>
            )}
          </div>
          {!tsLoading && teamSeasonId != null && (
            <span className="shrink-0 text-sm text-[var(--muted)]">
              {players.length} Spieler
            </span>
          )}
        </div>
        {tsError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {tsError}
          </p>
        )}
      </Card>

      <TeamMembershipRolesCard teamSeasonId={teamSeasonId} />

      {/* Kader Card */}
      <Card className="rounded-3xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.12)_0%,rgba(0,0,0,0.25)_100%)] shadow-[0_0_0_1px_rgba(239,68,68,0.10),0_18px_50px_rgba(0,0,0,0.55)] ring-1 ring-red-500/10">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="mt-0">Kader</CardTitle>
          {teamSeasonId != null && canManagePlayers && !plLoading && (
            <Button type="button" variant="secondary" size="sm" onClick={openCreateForm}>
              + Spieler
            </Button>
          )}
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
                <span className="flex gap-2">
                  {canManagePlayers && (
                    <Button type="submit" disabled={saving || !form.first_name.trim() || jerseyTaken}>
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
            <ul className="mt-3 space-y-2.5">
              {sortedPlayers.map((p) => (
                <li
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditForm(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEditForm(p);
                    }
                  }}
                  className={[
                    "group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.10)_0%,rgba(0,0,0,0.20)_100%)] px-4 py-3",
                    "transition-transform transition-colors duration-180 ease-out hover:bg-[linear-gradient(180deg,rgba(239,68,68,0.12)_0%,rgba(255,255,255,0.02)_100%)] hover:border-red-500/25",
                    "active:scale-[0.98] active:bg-[rgba(239,68,68,0.18)] active:border-red-500/30 active:shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_12px_28px_rgba(0,0,0,0.35)]",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="w-9 shrink-0 text-right text-xs tabular-nums font-semibold text-white/65">
                      {p.jersey_number != null ? `#${p.jersey_number}` : "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 break-words text-base font-semibold leading-snug text-white/95">
                        {p.display_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {(() => {
                      const label = abbreviatePositionLabel(p.position);
                      return (
                        <span className="rounded-lg border border-red-500/25 bg-[rgba(239,68,68,0.10)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm shadow-[0_8px_24px_rgba(239,68,68,0.08)]">
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
        </div>

        <div className="mt-3 space-y-3 lg:mt-0 lg:sticky lg:top-28 lg:self-start">
      <Tabs
        tabs={visibleTabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TeamTabId)}
      />

      <section className="space-y-3">
        {activeTab === "overview" && (
          <Card>
            <CardTitle>Team-Übersicht</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Kurzer Überblick über das Team. Später siehst du hier
              Spieleranzahl, Saisonstatistiken und wichtige Hinweise.
            </p>
          </Card>
        )}

        {activeTab === "training" && (
          <RequireFeature feature="training">
            <Card>
              <CardTitle>Training</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Trainingsplan-Übersicht. Eltern und Spieler sehen hier die
                kommenden Einheiten.
              </p>

              {canManagePlayers ? (
                <div className="mt-3">
                  <Button>Training bearbeiten</Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Read-only Ansicht. Trainer bearbeiten den Plan zentral.
                </p>
              )}
            </Card>
          </RequireFeature>
        )}

        {activeTab === "squad" && (
          <Card>
            <CardTitle>Kader (Details)</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Spielerliste siehe Kader-Card oben.
            </p>
          </Card>
        )}
      </section>
        </div>
      </div>
    </div>
  );
};

