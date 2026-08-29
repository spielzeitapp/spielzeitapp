/**
 * STEP 4: Manager-Saisonübersicht (aktive, Entwürfe, Archiv).
 * Nutzt bestehende Lifecycle-/Transition-Libs — keine parallele Kaderlogik.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import {
  canPrepareNextSeason,
  getSeasonStatusLabel,
  SEASON_SOFT_LOCK_MESSAGE,
} from '../lib/seasonLifecycle';
import {
  fetchSeasonManagementSnapshot,
  mapPrepareDraftError,
  type SeasonCardModel,
  type SeasonManagementSnapshot,
} from '../lib/seasonManagementData';
import {
  archiveTeamSeason,
  completeSeasonTransition,
  DEFAULT_SEASON_TRANSFER_OPTIONS,
  prepareSeasonDraftWithOptions,
} from '../lib/seasonTransition';
import { SeasonTransitionWizard } from '../components/season/SeasonTransitionWizard';
import { ManagerTrainingVenuesPanel } from './ManagerTrainingVenuesPanel';
import { ManagerStaffAssignmentPanel } from './ManagerStaffAssignmentPanel';
import { useManagerWorkMode } from './ManagerWorkModeContext';
import type { ManagerWorkMode } from './managerWorkMode';

function canAccess(effectiveRole: string, backendRole: string, workMode: ManagerWorkMode): boolean {
  if (workMode === 'platform_admin' && (backendRole ?? '').trim().toLowerCase() === 'admin') {
    return true;
  }
  if (canPrepareNextSeason(effectiveRole) || canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

function statusChip(status: string): string {
  if (status === 'active') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'draft') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function SeasonSummaryCard({
  model,
  emphasis,
}: {
  model: SeasonCardModel;
  emphasis?: 'active' | 'draft' | 'archived';
}): React.ReactElement {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        emphasis === 'active'
          ? 'border-emerald-200'
          : emphasis === 'draft'
            ? 'border-amber-200'
            : 'border-slate-200/90'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900">{model.displayName}</h2>
          <p className="mt-1 text-[13px] text-slate-600">
            {model.ageGroup ? `${model.ageGroup} · ` : ''}
            {model.seasonName ?? 'Saison'}
            {model.playerCount != null
              ? ` · ${model.playerCount} aktiv${
                  model.pausedCount ? ` · ${model.pausedCount} pausiert` : ''
                }`
              : ''}
            {model.eventCount != null ? ` · ${model.eventCount} Termine` : ''}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusChip(
            model.status,
          )}`}
        >
          {model.statusLabel}
        </span>
      </div>
      {model.preparedFromLabel ? (
        <p className="mt-2 text-[12px] text-slate-500">Aus: {model.preparedFromLabel}</p>
      ) : null}
    </div>
  );
}

export function ManagerSeasonsPage(): React.ReactElement {
  const navigate = useNavigate();
  const {
    effectiveRole,
    backendRole,
    selectedTeamSeasonId,
    reloadSessionTeamSeasons,
    setSelectedTeamSeasonId,
    setViewTeamSeasonId,
  } = useSession();
  const { workMode, isTrainerMode } = useManagerWorkMode();
  const allowed = canAccess(effectiveRole, backendRole, workMode);

  const [snapshot, setSnapshot] = useState<SeasonManagementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showOefb, setShowOefb] = useState(false);

  const reload = useCallback(async (override?: string | null) => {
    const id = override ?? selectedTeamSeasonId;
    if (!id) {
      setSnapshot(null);
      setError('Keine Mannschaft gewählt.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetchSeasonManagementSnapshot(id);
    setSnapshot(res.data);
    setError(res.error);
    setLoading(false);
  }, [selectedTeamSeasonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!allowed) {
    return <Navigate to="/manager" replace />;
  }

  const active = snapshot?.active ?? null;
  const draft = snapshot?.draft ?? null;
  const archived = snapshot?.archived ?? [];

  const onPrepare = async (result: {
    seasonName: string;
    ageGroup: string;
    options: import('../lib/seasonTransition').SeasonTransferOptions;
    confirmArchiveSource: boolean;
  }) => {
    if (!active?.id || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await prepareSeasonDraftWithOptions({
      sourceTeamSeasonId: active.id,
      seasonName: result.seasonName,
      ageGroup: result.ageGroup,
      options: result.options,
    });
    setBusy(false);
    if (!res.ok) {
      setError(mapPrepareDraftError(res.code, res.message));
      return;
    }
    setShowWizard(false);
    setSuccess(
      'Saisonentwurf erstellt. Die bisherige Saison bleibt aktiv, bis du die neue Saison ausdrücklich aktivierst.',
    );
    await reload();
  };

  const onActivate = async () => {
    if (!active?.id || !draft?.id || busy) return;
    if (
      !window.confirm(
        `Die Saison ${draft.displayName} wird zur aktiven Saison dieser Mannschaft.\n\nDie bisherige Saison ${active.displayName} wird abgeschlossen und bleibt mit Kader, Terminen, Trainings, Spielen, Feeds und Statistiken als Historie erhalten.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await completeSeasonTransition({
      sourceTeamSeasonId: active.id,
      existingDraftTeamSeasonId: draft.id,
      options: { ...DEFAULT_SEASON_TRANSFER_OPTIONS, transferFutureEvents: false },
      confirmArchiveSource: true,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    await reloadSessionTeamSeasons(res.newTeamSeasonId);
    setSelectedTeamSeasonId(res.newTeamSeasonId);
    setSuccess('Saison aktiviert. Du arbeitest jetzt in der neuen Saison.');
    setShowOefb(true);
    await reload(res.newTeamSeasonId);
  };

  const onArchive = async () => {
    if (!active?.id || busy) return;
    if (
      !window.confirm(
        'Saison abschließen?\n\nDie Saison bleibt vollständig lesbar. Neue Termine und Planungen sollen danach in der neuen aktiven Saison erstellt werden.',
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await archiveTeamSeason(active.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSuccess('Saison abgeschlossen.');
    await reload();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Mein Team
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Saisonen</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Aktive Planung, Entwürfe und historische Kader einer Mannschaft.
          </p>
        </div>
        {active && !draft ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowWizard(true)}
            className="inline-flex min-h-[44px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            Neue Saison vorbereiten
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          {success}
        </div>
      ) : null}

      {workMode === 'club_admin' && selectedTeamSeasonId ? (
        <ManagerStaffAssignmentPanel teamSeasonId={selectedTeamSeasonId} />
      ) : null}

      {loading ? <p className="text-[13px] text-slate-400">Saisons werden geladen…</p> : null}

      {!loading && !snapshot?.active && !snapshot?.draft && archived.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-[13px] text-slate-500">
          Für diese Mannschaft wurde noch keine Saison angelegt.
        </p>
      ) : null}

      {active || draft ? (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          {active ? (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold text-slate-800">Aktive Saison</h2>
          <SeasonSummaryCard model={active} emphasis="active" />
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/manager/saisons/${encodeURIComponent(active.id)}/kader`}
              className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white"
            >
              Kader verwalten
            </Link>
            <Link
              to="/manager/training/chronik"
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-800"
            >
              Trainingschronik
            </Link>
            <Link
              to={`/manager/saisons/${encodeURIComponent(active.id)}/oefb-import`}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-800"
            >
              ÖFB-Spielplan importieren
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onArchive()}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-700 disabled:opacity-50"
            >
              Saison abschließen
            </button>
          </div>
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            STEP 5: ÖFB-Spielplan mit Vorschau in diese Saison importieren — Dubletten und geschützte
            Termine werden erkannt.
          </p>
          {!isTrainerMode ? (
          <ManagerTrainingVenuesPanel
            teamSeasonId={active.id}
            effectiveRole={effectiveRole}
            backendRole={backendRole}
          />
          ) : null}
        </section>
          ) : null}

          {draft ? (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold text-slate-800">Saisonentwurf</h2>
          <SeasonSummaryCard model={draft} emphasis="draft" />
          <p className="text-[13px] text-slate-600">
            Die neue Saison ist vorbereitet. Die bisherige Saison bleibt aktiv, bis du die neue
            Saison ausdrücklich aktivierst.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/manager/saisons/${encodeURIComponent(draft.id)}/kader`}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-800"
            >
              Entwurf-Kader prüfen
            </Link>
            <button
              type="button"
              disabled={busy || !active}
              onClick={() => void onActivate()}
              className="inline-flex min-h-[44px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Aktiviere…' : 'Saison aktivieren'}
            </button>
          </div>
        </section>
          ) : null}
        </div>
      ) : null}

      {showOefb && active ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          Nächster Schritt:{' '}
          <Link
            to={`/manager/saisons/${encodeURIComponent(active.id)}/oefb-import`}
            className="font-semibold text-red-700 underline"
          >
            ÖFB-Spielplan importieren (STEP 5)
          </Link>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-slate-800">Archivierte Saisonen</h2>
        {archived.length === 0 ? (
          <p className="text-[13px] text-slate-400">Es gibt noch keine archivierten Saisonen.</p>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {archived.map((a) => (
              <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{a.displayName}</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {getSeasonStatusLabel(a.status)}
                      {a.ageGroup ? ` · ${a.ageGroup}` : ''}
                      {a.playerCount != null ? ` · ${a.playerCount + (a.pausedCount ?? 0)} Spieler` : ''}
                      {a.eventCount != null ? ` · ${a.eventCount} Termine` : ''}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-400">{SEASON_SOFT_LOCK_MESSAGE}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setViewTeamSeasonId(a.id);
                        navigate(`/manager/saisons/${encodeURIComponent(a.id)}/kader`);
                      }}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-800"
                    >
                      Historischen Kader
                    </button>
                    <Link
                      to="/manager/training/chronik"
                      onClick={() => setViewTeamSeasonId(a.id)}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-800"
                    >
                      Chronik
                    </Link>
                    <Link
                      to="/app/home"
                      onClick={() => setViewTeamSeasonId(a.id)}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-800"
                    >
                      Feed
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showWizard && active ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-900/40 p-3 sm:p-6">
          <div className="mx-auto max-w-lg rounded-2xl shadow-xl">
            <SeasonTransitionWizard
              mode="prepare"
              sourceTeamSeasonId={active.id}
              sourceSeasonName={active.seasonName}
              sourceAgeGroup={active.ageGroup}
              sourceTeamName={active.teamName}
              busy={busy}
              onCancel={() => setShowWizard(false)}
              onConfirm={(r) => void onPrepare(r)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
