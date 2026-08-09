/**
 * STEP 3C: Trainingsvorlagen-Übersicht.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { useEvents } from '../hooks/useEvents';
import { resolveClubIdForTeamSeason } from '../lib/venues';
import {
  applyTemplateToEvent,
  archiveTrainingTemplate,
  copyTrainingSession,
  countTemplateUsages,
  listTrainingTemplates,
} from '../lib/trainingSessionOps';
import { listSessionExercises, type TrainingSessionRow } from '../lib/trainingSessions';
import {
  EXERCISE_FOCUS_LABELS,
  TRAINING_SESSION_STATUS_LABELS,
  type ExerciseFocus,
} from '../lib/trainingPhases';
import { getTrainingSessionByEvent } from '../lib/trainingSessions';
import { VIENNA_TZ } from '../lib/viennaTime';

type TemplateCard = TrainingSessionRow & {
  exerciseCount: number;
  duration: number;
  usageCount: number;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function ManagerTrainingTemplatesPage(): React.ReactElement {
  const navigate = useNavigate();
  const { user, selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;

  const { events } = useEvents(teamSeasonId);
  const [rows, setRows] = useState<TemplateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyFor, setApplyFor] = useState<TrainingSessionRow | null>(null);
  const [eventId, setEventId] = useState('');
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});

  const trainings = useMemo(
    () =>
      events
        .filter((e) => e.kind === 'training' || e.type === 'training')
        .filter((e) => String(e.status ?? '').toLowerCase() !== 'canceled')
        .filter((e) => new Date(e.starts_at).getTime() >= Date.now() - 2 * 60 * 60 * 1000)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events],
  );

  const reload = useCallback(async () => {
    if (!teamSeasonId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
    if (!clubRes.clubId) {
      setError(clubRes.error ?? 'Verein nicht ermittelbar.');
      setLoading(false);
      return;
    }
    const res = await listTrainingTemplates({
      clubId: clubRes.clubId,
      includeArchived,
    });
    if (res.error) {
      setError(res.error);
      setRows([]);
      setLoading(false);
      return;
    }
    const cards: TemplateCard[] = [];
    for (const t of res.data) {
      const [items, usage] = await Promise.all([
        listSessionExercises(t.id),
        countTemplateUsages(t.id),
      ]);
      cards.push({
        ...t,
        exerciseCount: items.data.length,
        duration:
          t.planned_duration_minutes ??
          items.data.reduce((s, i) => s + (i.duration_minutes || 0), 0),
        usageCount: usage.count,
      });
    }
    setRows(cards);
    setLoading(false);
  }, [teamSeasonId, includeArchived]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!applyFor || trainings.length === 0) {
      setBlocked({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, boolean> = {};
      await Promise.all(
        trainings.map(async (ev) => {
          const res = await getTrainingSessionByEvent(ev.id);
          if (res.data) map[ev.id] = true;
        }),
      );
      if (!cancelled) setBlocked(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyFor, trainings]);

  const createBlank = async () => {
    if (!teamSeasonId || !contextSeason || busyId) return;
    setBusyId('new');
    setError(null);
    const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
    if (!clubRes.clubId) {
      setError(clubRes.error ?? 'Verein nicht ermittelbar.');
      setBusyId(null);
      return;
    }
    const teamId = String(
      (contextSeason as { team_id?: string | number }).team_id ??
        (contextSeason as { team?: { id?: string } }).team?.id ??
        '',
    ).trim();
    if (!teamId) {
      setError('Keine Mannschaft im Kontext.');
      setBusyId(null);
      return;
    }
    const { createTrainingSession } = await import('../lib/trainingSessions');
    const created = await createTrainingSession({
      clubId: clubRes.clubId,
      teamId,
      teamSeasonId,
      title: 'Neue Vorlage',
      status: 'draft',
      recordType: 'template',
      ageGroup: contextSeason.age_group ?? null,
    });
    setBusyId(null);
    if (created.error || !created.data) {
      setError(created.error ?? 'Vorlage konnte nicht angelegt werden.');
      return;
    }
    navigate(`/manager/training/einheiten/${encodeURIComponent(created.data.id)}`);
  };

  const duplicate = async (tpl: TrainingSessionRow) => {
    if (busyId) return;
    setBusyId(tpl.id);
    const res = await copyTrainingSession({ sourceId: tpl.id, mode: 'template' });
    setBusyId(null);
    if (res.error || !res.data) {
      setError(res.error ?? 'Duplizieren fehlgeschlagen.');
      return;
    }
    setSuccess('Vorlage dupliziert.');
    await reload();
  };

  const archive = async (tpl: TrainingSessionRow) => {
    if (busyId) return;
    if (!window.confirm(`Vorlage „${tpl.title}“ archivieren?`)) return;
    setBusyId(tpl.id);
    const res = await archiveTrainingTemplate(tpl.id, user?.id ?? null);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess('Vorlage archiviert.');
    await reload();
  };

  const apply = async () => {
    if (!applyFor || !eventId || busyId) return;
    setBusyId(applyFor.id);
    setError(null);
    const res = await applyTemplateToEvent({ templateId: applyFor.id, eventId });
    setBusyId(null);
    if (res.error || !res.data) {
      setError(res.error ?? 'Zuweisung fehlgeschlagen.');
      return;
    }
    setApplyFor(null);
    setEventId('');
    setSuccess('Einheit aus Vorlage erstellt.');
    navigate(`/manager/training/einheiten/${encodeURIComponent(res.data.id)}`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sport</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Vorlagen</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Wiederverwendbare Trainingspläne ohne Termin, Anwesenheit oder Platz.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to="/manager/training/einheiten"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800"
          >
            Planung
          </Link>
          <button
            type="button"
            disabled={Boolean(busyId)}
            onClick={() => void createBlank()}
            className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            Neue Vorlage
          </button>
        </div>
      </header>

      <label className="inline-flex items-center gap-2 text-[13px] text-slate-600">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
          className="accent-red-600"
        />
        Archivierte anzeigen
      </label>

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

      {loading ? <p className="text-[13px] text-slate-400">Vorlagen werden geladen…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-[13px] text-slate-500">
          Noch keine Vorlagen. Speichere eine Einheit als Vorlage oder lege eine neue an.
        </p>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3 2xl:items-stretch">
          {rows.map((t) => (
            <li
              key={t.id}
              className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{t.title}</p>
                  <p className="mt-1 text-[13px] text-slate-600">
                    {t.focus ? EXERCISE_FOCUS_LABELS[t.focus as ExerciseFocus] ?? t.focus : 'Kein Schwerpunkt'}
                    {t.age_group ? ` · ${t.age_group}` : ''}
                    {` · ${t.exerciseCount} Übungen · ${t.duration} Min.`}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {TRAINING_SESSION_STATUS_LABELS[t.status]}
                    {t.usageCount > 0 ? ` · ${t.usageCount}× verwendet` : ''}
                    {t.updated_at
                      ? ` · geändert ${new Intl.DateTimeFormat('de-AT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }).format(new Date(t.updated_at))}`
                      : ''}
                  </p>
                  {t.objective ? (
                    <p className="mt-2 line-clamp-2 text-[13px] text-slate-500">{t.objective}</p>
                  ) : null}
                </div>
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <Link
                    to={`/manager/training/einheiten/${encodeURIComponent(t.id)}`}
                    className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-3 text-[12px] font-semibold text-white"
                  >
                    Öffnen
                  </Link>
                  <button
                    type="button"
                    disabled={Boolean(busyId) || t.status === 'archived'}
                    onClick={() => {
                      setApplyFor(t);
                      setEventId('');
                      setError(null);
                    }}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-800 disabled:opacity-50"
                  >
                    Für Termin
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void duplicate(t)}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-800 disabled:opacity-50"
                  >
                    Duplizieren
                  </button>
                  {t.status !== 'archived' ? (
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void archive(t)}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 disabled:opacity-50"
                    >
                      Archivieren
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {applyFor ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center"
          role="presentation"
          onClick={() => setApplyFor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[17px] font-semibold text-slate-900">Vorlage für Termin</h2>
            <p className="mt-1 text-[13px] text-slate-500">{applyFor.title}</p>
            <label className="mt-4 block text-[12px] font-medium text-slate-600">
              Trainingstermin
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
              >
                <option value="">Bitte wählen…</option>
                {trainings.map((ev) => (
                  <option key={ev.id} value={ev.id} disabled={Boolean(blocked[ev.id])}>
                    {formatWhen(ev.starts_at)}
                    {blocked[ev.id] ? ' — bereits verplant' : ''}
                  </option>
                ))}
              </select>
            </label>
            {trainings.length === 0 ? (
              <p className="mt-2 text-[12px] text-amber-700">Kein geeigneter Termin vorhanden.</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setApplyFor(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!eventId || Boolean(busyId)}
                onClick={() => void apply()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busyId ? 'Erstelle…' : 'Einheit erzeugen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
