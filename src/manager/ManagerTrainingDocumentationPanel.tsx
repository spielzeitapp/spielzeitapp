/**
 * STEP 3C: Dokumentation / Abschluss einer Trainingseinheit.
 */

import React, { useState } from 'react';
import {
  TRAINING_EXERCISE_REVIEW_LABELS,
  TRAINING_REVIEW_RATING_LABELS,
  type TrainingExerciseReviewStatus,
  type TrainingReviewRating,
} from '../lib/trainingPhases';
import {
  completeTrainingSession,
  saveTrainingDocumentation,
  updateExerciseReview,
} from '../lib/trainingSessionOps';
import type { TrainingSessionExerciseRow, TrainingSessionRow } from '../lib/trainingSessions';
import type { TrainingExerciseRow } from '../lib/trainingExercises';

type Props = {
  session: TrainingSessionRow;
  items: TrainingSessionExerciseRow[];
  exerciseMap: Record<string, TrainingExerciseRow>;
  userId: string | null | undefined;
  readOnlyCompleted?: boolean;
  onUpdated: (session: TrainingSessionRow) => void;
  onItemsChanged: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
};

export function ManagerTrainingDocumentationPanel({
  session,
  items,
  exerciseMap,
  userId,
  readOnlyCompleted = false,
  onUpdated,
  onItemsChanged,
  onError,
  onSuccess,
}: Props): React.ReactElement | null {
  if (session.record_type === 'template') return null;

  const locked = session.status === 'completed' && readOnlyCompleted;
  const [actualDuration, setActualDuration] = useState(
    session.actual_duration_minutes?.toString() ?? '',
  );
  const [rating, setRating] = useState<TrainingReviewRating | ''>(session.review_rating ?? '');
  const [workedWell, setWorkedWell] = useState(session.worked_well ?? '');
  const [needsImprovement, setNeedsImprovement] = useState(session.needs_improvement ?? '');
  const [reviewNotes, setReviewNotes] = useState(session.review_notes ?? '');
  const [repeatNext, setRepeatNext] = useState(session.repeat_next_time);
  const [busy, setBusy] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [editUnlocked, setEditUnlocked] = useState(false);

  const editing = !locked || editUnlocked;
  const notDone = items.filter(
    (i) => i.review_status === 'not_done' || i.was_completed === false,
  );

  const saveDoc = async () => {
    if (busy) return;
    setBusy(true);
    const mins = actualDuration.trim() === '' ? null : Number(actualDuration);
    if (mins != null && (!Number.isFinite(mins) || mins <= 0 || mins > 480)) {
      onError('Tatsächliche Dauer: 1–480 Minuten.');
      setBusy(false);
      return;
    }
    const res = await saveTrainingDocumentation(session.id, {
      actualDurationMinutes: mins,
      reviewRating: rating || null,
      reviewNotes: reviewNotes.trim() || null,
      workedWell: workedWell.trim() || null,
      needsImprovement: needsImprovement.trim() || null,
      repeatNextTime: repeatNext,
    });
    setBusy(false);
    if (res.error || !res.data) {
      onError(res.error ?? 'Dokumentation speichern fehlgeschlagen.');
      return;
    }
    onUpdated(res.data);
    onSuccess('Dokumentation gespeichert.');
    setEditUnlocked(false);
  };

  const complete = async () => {
    if (busy || !userId) {
      if (!userId) onError('Nicht angemeldet.');
      return;
    }
    setBusy(true);
    const mins = actualDuration.trim() === '' ? null : Number(actualDuration);
    if (mins != null && (!Number.isFinite(mins) || mins <= 0 || mins > 480)) {
      onError('Tatsächliche Dauer: 1–480 Minuten.');
      setBusy(false);
      return;
    }
    const doc = await saveTrainingDocumentation(session.id, {
      actualDurationMinutes: mins,
      reviewRating: rating || null,
      reviewNotes: reviewNotes.trim() || null,
      workedWell: workedWell.trim() || null,
      needsImprovement: needsImprovement.trim() || null,
      repeatNextTime: repeatNext,
    });
    if (doc.error) {
      setBusy(false);
      onError(doc.error);
      return;
    }
    const res = await completeTrainingSession(session.id, userId, {
      actualDurationMinutes: mins,
    });
    setBusy(false);
    setConfirmComplete(false);
    if (res.error || !res.data) {
      onError(res.error ?? 'Abschluss fehlgeschlagen.');
      return;
    }
    onUpdated(res.data);
    onSuccess('Training abgeschlossen.');
  };

  const setReview = async (
    item: TrainingSessionExerciseRow,
    status: TrainingExerciseReviewStatus | null,
  ) => {
    if (busy || !editing) return;
    setBusy(true);
    const res = await updateExerciseReview(item.id, {
      reviewStatus: status,
      wasCompleted: status === 'not_done' ? false : status ? true : null,
      repeatRecommended: status === 'repeat',
    });
    setBusy(false);
    if (res.error) onError(res.error);
    else onItemsChanged();
  };

  return (
    <section
      id="training-doc"
      className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Training dokumentieren</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Nachbereitung für diese Einheit – Anwesenheit und Termin bleiben unverändert.
          </p>
        </div>
        {session.status === 'completed' && !editUnlocked ? (
          <button
            type="button"
            onClick={() => setEditUnlocked(true)}
            className="min-h-[40px] rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-800"
          >
            Dokumentation bearbeiten
          </button>
        ) : null}
      </div>

      {session.status === 'completed' ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          Training abgeschlossen
          {session.completed_at
            ? ` · ${new Intl.DateTimeFormat('de-AT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(session.completed_at))}`
            : ''}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-slate-600">
          Tatsächliche Dauer (Min.)
          <input
            type="number"
            min={1}
            max={480}
            disabled={!editing || busy}
            value={actualDuration}
            onChange={(e) => setActualDuration(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px] disabled:bg-slate-50"
          />
        </label>
        <label className="text-[12px] font-semibold text-slate-600">
          Gesamtbewertung
          <select
            disabled={!editing || busy}
            value={rating}
            onChange={(e) => setRating(e.target.value as TrainingReviewRating | '')}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px] disabled:bg-slate-50"
          >
            <option value="">—</option>
            {(Object.keys(TRAINING_REVIEW_RATING_LABELS) as TrainingReviewRating[]).map((k) => (
              <option key={k} value={k}>
                {TRAINING_REVIEW_RATING_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-slate-600 sm:col-span-2">
          Was gut funktioniert hat
          <textarea
            disabled={!editing || busy}
            value={workedWell}
            onChange={(e) => setWorkedWell(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] disabled:bg-slate-50"
          />
        </label>
        <label className="text-[12px] font-semibold text-slate-600 sm:col-span-2">
          Was angepasst werden musste
          <textarea
            disabled={!editing || busy}
            value={needsImprovement}
            onChange={(e) => setNeedsImprovement(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] disabled:bg-slate-50"
          />
        </label>
        <label className="text-[12px] font-semibold text-slate-600 sm:col-span-2">
          Weitere Notizen
          <textarea
            disabled={!editing || busy}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] disabled:bg-slate-50"
          />
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-[13px] text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            disabled={!editing || busy}
            checked={repeatNext}
            onChange={(e) => setRepeatNext(e.target.checked)}
            className="accent-red-600"
          />
          Für nächstes Training wiederholen
        </label>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <h3 className="text-[13px] font-semibold text-slate-800">Übungen markieren</h3>
        <ul className="space-y-2">
          {items.map((it) => {
            const ex = exerciseMap[it.exercise_id];
            return (
              <li
                key={it.id}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <p className="font-medium text-slate-900">{ex?.title ?? 'Übung'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(Object.keys(TRAINING_EXERCISE_REVIEW_LABELS) as TrainingExerciseReviewStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={!editing || busy}
                        onClick={() => void setReview(it, st)}
                        className={`min-h-[40px] rounded-full px-3 text-[12px] font-semibold disabled:opacity-50 ${
                          it.review_status === st
                            ? 'bg-red-700 text-white'
                            : 'border border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {TRAINING_EXERCISE_REVIEW_LABELS[st]}
                      </button>
                    ),
                  )}
                </div>
                {editing ? (
                  <label className="mt-2 block text-[12px] text-slate-600">
                    Übungsnotiz
                    <input
                      defaultValue={it.review_notes ?? ''}
                      disabled={busy}
                      onBlur={(e) => {
                        void updateExerciseReview(it.id, {
                          reviewNotes: e.target.value.trim() || null,
                        }).then((res) => {
                          if (res.error) onError(res.error);
                          else onItemsChanged();
                        });
                      }}
                      className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-200 px-2 text-[13px]"
                    />
                  </label>
                ) : it.review_notes ? (
                  <p className="mt-2 text-[12px] text-slate-600">{it.review_notes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveDoc()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
          >
            {busy ? 'Speichern…' : 'Dokumentation speichern'}
          </button>
          {session.status !== 'completed' ? (
            !confirmComplete ? (
              <button
                type="button"
                disabled={busy || !userId}
                onClick={() => setConfirmComplete(true)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                Training abschließen
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
                <span>
                  Abschließen?
                  {notDone.length > 0
                    ? ` ${notDone.length} Übung(en) nicht durchgeführt.`
                    : ''}{' '}
                  Termin und Anwesenheit bleiben unverändert.
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void complete()}
                  className="rounded-full bg-red-700 px-3 py-1.5 font-semibold text-white"
                >
                  Ja, abschließen
                </button>
                <button type="button" onClick={() => setConfirmComplete(false)} className="underline">
                  Abbrechen
                </button>
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
