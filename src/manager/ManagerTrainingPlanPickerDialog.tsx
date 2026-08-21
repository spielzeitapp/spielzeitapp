import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCopy,
  FilePlus2,
  Files,
  History,
  LayoutTemplate,
  X,
} from 'lucide-react';
import type { EventRow } from '../hooks/useEvents';
import { copyTrainingSession } from '../lib/trainingSessionOps';
import type { TrainingSessionRow } from '../lib/trainingSessions';
import { VIENNA_TZ } from '../lib/viennaTime';

type PickerMode = 'start' | 'templates' | 'plans';

type Props = {
  event: EventRow | null;
  savedPlans: TrainingSessionRow[];
  templates: TrainingSessionRow[];
  lastSession: TrainingSessionRow | null;
  onClose: () => void;
};

function formatEvent(iso: string): string {
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
    return 'Trainingstermin';
  }
}

function cleanTitle(session: TrainingSessionRow): string {
  return session.title.replace(/^Vorlage:\s*/i, '').replace(/\s*\(Kopie(?:\s*\d+)?\)\s*$/i, '').trim();
}

export function ManagerTrainingPlanPickerDialog({
  event,
  savedPlans,
  templates,
  lastSession,
  onClose,
}: Props): React.ReactElement | null {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PickerMode>('start');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setMode('start');
    setBusyId(null);
    setError(null);
  }, [event?.id]);

  const sortedPlans = useMemo(
    () =>
      [...savedPlans].sort((a, b) =>
        String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')),
      ),
    [savedPlans],
  );

  if (!event) return null;

  const usePlan = async (source: TrainingSessionRow) => {
    if (busyId) return;
    setBusyId(source.id);
    setError(null);
    const result = await copyTrainingSession({
      sourceId: source.id,
      mode: 'event',
      eventId: event.id,
      title: cleanTitle(source) || 'Trainingseinheit',
    });
    setBusyId(null);
    if (result.error || !result.data) {
      setError(result.error ?? 'Der Trainingsplan konnte nicht übernommen werden.');
      return;
    }
    onClose();
    navigate(`/manager/training/einheiten/${encodeURIComponent(result.data.id)}`);
  };

  const startOptions = [
    {
      id: 'templates',
      title: 'Vorlage verwenden',
      description: 'Einen wiederverwendbaren Trainingsplan auswählen',
      icon: LayoutTemplate,
      disabled: templates.length === 0,
      onClick: () => setMode('templates'),
    },
    {
      id: 'plans',
      title: 'Gespeicherten Plan verwenden',
      description: 'Einen fertigen Plan übernehmen und anpassen',
      icon: Files,
      disabled: sortedPlans.length === 0,
      recommended: true,
      onClick: () => setMode('plans'),
    },
    {
      id: 'last',
      title: 'Letzte Einheit kopieren',
      description: lastSession
        ? `${cleanTitle(lastSession)} als Ausgangspunkt nehmen`
        : 'Noch keine geeignete Einheit vorhanden',
      icon: History,
      disabled: !lastSession,
      onClick: () => lastSession && void usePlan(lastSession),
    },
    {
      id: 'new',
      title: 'Neue Einheit erstellen',
      description: 'Eine leere Trainingseinheit zusammenstellen',
      icon: FilePlus2,
      disabled: false,
      onClick: () => {
        onClose();
        navigate(
          `/manager/training/einheiten/neu?event=${encodeURIComponent(event.id)}&starts=${encodeURIComponent(event.starts_at)}`,
        );
      },
    },
  ];

  const selectionRows = mode === 'templates' ? templates : sortedPlans;
  const selectionTitle = mode === 'templates' ? 'Vorlage auswählen' : 'Gespeicherten Plan auswählen';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busyId) onClose();
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-plan-picker-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-2">
            {mode !== 'start' ? (
              <button
                type="button"
                onClick={() => setMode('start')}
                disabled={Boolean(busyId)}
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Zurück"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <div>
              <h2 id="training-plan-picker-title" className="text-[18px] font-bold text-slate-950">
                {mode === 'start' ? `Training für ${formatEvent(event.starts_at)} planen` : selectionTitle}
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {mode === 'start'
                  ? 'Wie möchtest du dieses Training planen?'
                  : 'Der Plan wird als bearbeitbare Kopie für diesen Termin angelegt.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busyId)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Dialog schließen"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5">
          {mode === 'start' ? (
            <div className="space-y-2.5">
              {startOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={option.onClick}
                    disabled={option.disabled || Boolean(busyId)}
                    className={[
                      'flex min-h-[72px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                      option.recommended
                        ? 'border-red-300 bg-red-50/70 hover:border-red-500 hover:bg-red-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      option.disabled ? 'cursor-not-allowed opacity-45' : '',
                    ].join(' ')}
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-slate-950">
                        {option.title}
                        {option.recommended ? (
                          <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Empfohlen
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-slate-500">{option.description}</span>
                    </span>
                    {busyId && option.id === 'last' ? (
                      <span className="text-[12px] text-slate-500">Wird geladen…</span>
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          ) : selectionRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-[13px] text-slate-500">
              Noch keine passenden {mode === 'templates' ? 'Vorlagen' : 'gespeicherten Pläne'} vorhanden.
            </div>
          ) : (
            <div className="space-y-2">
              {selectionRows.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => void usePlan(plan)}
                  disabled={Boolean(busyId)}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-red-300 hover:bg-red-50/40 disabled:opacity-55"
                >
                  <ClipboardCopy className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-slate-950">
                      {cleanTitle(plan)}
                    </span>
                    <span className="block text-[12px] text-slate-500">
                      {plan.planned_duration_minutes != null
                        ? `${plan.planned_duration_minutes} Min.`
                        : 'Dauer noch nicht festgelegt'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-red-700">
                    {busyId === plan.id ? 'Wird übernommen…' : 'Plan verwenden'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            <ClipboardCopy className="h-4 w-4 shrink-0" aria-hidden />
            Der ursprüngliche Plan bleibt unverändert. Du bearbeitest eine Kopie für diesen Termin.
          </div>
        </div>
      </div>
    </div>
  );
}
