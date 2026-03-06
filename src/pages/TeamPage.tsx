import React, { useState } from "react";
import { useSession } from "../auth/useSession";
import { RequireFeature } from "../auth/rbac";
import { Card, CardTitle } from "../app/components/ui/Card";
import { Tabs, TabOption } from "../app/components/ui/Tabs";
import { Button } from "../app/components/ui/Button";
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

  return (
    <div className="space-y-3 pb-4">
      <h1 className="text-xl font-semibold">Team</h1>

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

      {/* Kader Card */}
      <Card>
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
                    disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
                  />
                </label>
                <span className="flex gap-2">
                  <Button type="submit" disabled={saving || !form.first_name.trim() || jerseyTaken}>
                    {saving ? "Speichern…" : "Speichern"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeForm} disabled={saving}>
                    Abbrechen
                  </Button>
                </span>
              </div>
            </form>
          )}
          {teamSeasonId != null && !plLoading && !plError && players.length === 0 && !showForm && (
            <p className="text-sm text-[var(--muted)]">
              Noch keine Spieler angelegt.
            </p>
          )}
          {teamSeasonId != null && !plLoading && !plError && players.length > 0 && (
            <ul className="divide-y divide-[var(--border)]">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-main)]">
                    {p.jersey_number != null ? `#${p.jersey_number} ` : ""}
                    {p.display_name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {p.position != null && p.position.trim() !== "" && (
                      <span className="rounded bg-[var(--border)]/80 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase text-[var(--muted)]">
                        {p.position}
                      </span>
                    )}
                    {canManagePlayers ? (
                      <span className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditForm(p)}
                          disabled={deletingId !== null || saving}
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          disabled={deletingId !== null || saving}
                          onClick={() => handleRemove(p.id)}
                        >
                          {deletingId === p.id ? "Entfernen…" : "Entfernen"}
                        </Button>
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]" aria-hidden>
                        ›
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

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
  );
};

