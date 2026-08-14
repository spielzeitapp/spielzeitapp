/**
 * Dialog: Einheit kopieren / als Vorlage / an Termin.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EventRow } from '../hooks/useEvents';
import {
  copyTrainingSession,
  type CopyTrainingMode,
} from '../lib/trainingSessionOps';
import type { TrainingSessionRow } from '../lib/trainingSessions';
import { getTrainingSessionByEvent } from '../lib/trainingSessions';

type Props = {
  open: boolean;
  session: TrainingSessionRow;
  trainingEvents: EventRow[];
  onClose: () => void;
  onDone?: (created: TrainingSessionRow) => void;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-AT', {
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

export function ManagerTrainingCopyDialog({
  open,
  session,
  trainingEvents,
  onClose,
  onDone,
}: Props): React.ReactElement | null {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CopyTrainingMode>('draft');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedEvents, setBlockedEvents] = useState<Record<string, boolean>>({});

  const upcoming = useMemo(() => {
    const now = Date.now() - 2 * 60 * 60 * 1000;
    return trainingEvents
      .filter((e) => new Date(e.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [trainingEvents]);

  useEffect(() => {
    if (!open) return;
    setMode(session.record_type === 'template' ? 'event' : 'draft');
    setEventId('');
    setError(null);
    setBusy(false);
  }, [open, session.id, session.record_type]);

  useEffect(() => {
    if (!open || upcoming.length === 0) {
      setBlockedEvents({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, boolean> = {};
      await Promise.all(
        upcoming.map(async (ev) => {
          const res = await getTrainingSessionByEvent(ev.id);
          if (res.data) map[ev.id] = true;
        }),
      );
      if (!cancelled) setBlockedEvents(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, upcoming]);

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await copyTrainingSession({
      sourceId: session.id,
      mode,
      eventId: mode === 'event' ? eventId : null,
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'Kopieren fehlgeschlagen.');
      return;
    }
    onDone?.(res.data);
    onClose();
    navigate(`/manager/training/einheiten/${encodeURIComponent(res.data.id)}`);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-training-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="copy-training-title" className="text-[17px] font-semibold text-slate-900">
          Einheit kopieren
        </h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Original bleibt unverändert. Nachbereitung und Anwesenheit werden nicht übernommen.
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Kopiermodus</legend>
          {(
            [
              ['draft', 'Als Entwurf ohne Termin kopieren'],
              ['event', 'Für bestehenden Trainingstermin kopieren'],
              ['template', 'Als Vorlage speichern'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-800"
            >
              <input
                type="radio"
                name="copy-mode"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="accent-red-600"
              />
              {label}
            </label>
          ))}
        </fieldset>

        {mode === 'event' ? (
          <label className="mt-3 block text-[12px] font-medium text-slate-600">
            Trainingstermin
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
            >
              <option value="">Bitte wählen…</option>
              {upcoming.map((ev) => {
                const blocked = Boolean(blockedEvents[ev.id]);
                return (
                  <option key={ev.id} value={ev.id} disabled={blocked}>
                    {formatWhen(ev.starts_at)}
                    {blocked ? ' — bereits verplant' : ''}
                  </option>
                );
              })}
            </select>
            {upcoming.length === 0 ? (
              <span className="mt-1 block text-[12px] text-amber-700">
                Kein geeigneter kommender Trainingstermin vorhanden.
              </span>
            ) : null}
          </label>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-700"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || (mode === 'event' && !eventId)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Wird kopiert…' : 'Kopieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
