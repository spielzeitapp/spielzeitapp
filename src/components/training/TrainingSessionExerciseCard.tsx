import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatPlayerCountRange, type TrainingExerciseRow } from '../../lib/trainingExercises';
import { EXERCISE_FOCUS_LABELS, TRAINING_PHASE_LABELS, type TrainingPhase } from '../../lib/trainingPhases';
import type { TrainingSessionExerciseRow } from '../../lib/trainingSessions';
import { TrainingExerciseImage } from './TrainingExerciseImage';
import { TrainingExerciseMetaChip } from './TrainingExerciseMetaChip';

type Props = {
  item: TrainingSessionExerciseRow;
  exercise: TrainingExerciseRow | undefined;
  sketchUrl?: string | null;
  onView: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onDurationChange: (minutes: number) => void;
  onNotesChange: (text: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  saving?: boolean;
  readOnly?: boolean;
};

export function TrainingSessionExerciseCard({
  item,
  exercise,
  sketchUrl,
  onView,
  onReplace,
  onRemove,
  onDurationChange,
  onNotesChange,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  saving = false,
  readOnly = false,
}: Props): React.ReactElement {
  const [notesOpen, setNotesOpen] = useState(Boolean(item.coach_notes?.trim()));
  const players = exercise
    ? formatPlayerCountRange(exercise.player_count_min, exercise.player_count_max)
    : null;
  const phaseLabel = TRAINING_PHASE_LABELS[item.phase as TrainingPhase] ?? item.phase;
  const notes = String(item.coach_notes ?? '').trim();

  return (
    <article className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4">
        <button
          type="button"
          onClick={onView}
          className="shrink-0 self-start touch-manipulation"
          aria-label={`${exercise?.title ?? 'Übung'} ansehen`}
        >
          <TrainingExerciseImage
            path={exercise?.image_path ?? null}
            title={exercise?.title ?? 'Übung'}
            url={sketchUrl}
            compact
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug text-slate-900">
                {exercise?.title ?? 'Übung'}
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {exercise ? (
                  <TrainingExerciseMetaChip>
                    {EXERCISE_FOCUS_LABELS[exercise.focus] ?? exercise.focus}
                  </TrainingExerciseMetaChip>
                ) : null}
                <TrainingExerciseMetaChip tone="phase">{phaseLabel}</TrainingExerciseMetaChip>
                {players ? <TrainingExerciseMetaChip>{players}</TrainingExerciseMetaChip> : null}
                <TrainingExerciseMetaChip>{item.duration_minutes} Min.</TrainingExerciseMetaChip>
              </div>
            </div>
          </div>

          {!readOnly ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-600">
                Dauer
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={item.duration_minutes}
                  onChange={(e) => onDurationChange(Number(e.target.value))}
                  className="w-14 rounded-md border border-slate-200 px-2 py-1 text-[13px] font-semibold text-slate-900"
                />
                Min.
              </label>
              <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                <button
                  type="button"
                  disabled={!canMoveUp || saving}
                  onClick={onMoveUp}
                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[12px] disabled:opacity-40"
                  aria-label="Nach oben"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown || saving}
                  onClick={onMoveDown}
                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[12px] disabled:opacity-40"
                  aria-label="Nach unten"
                >
                  ↓
                </button>
              </div>
            </div>
          ) : null}

          {notes || !readOnly ? (
            <div className="mt-3 rounded-lg border border-slate-200/80 bg-white">
              <button
                type="button"
                onClick={() => setNotesOpen((open) => !open)}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-semibold text-slate-700"
              >
                <span>Trainerhinweise{notes && !notesOpen ? ' (gekürzt)' : ''}</span>
                {notesOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                )}
              </button>
              {notesOpen ? (
                <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                  {readOnly ? (
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{notes || '—'}</p>
                  ) : (
                    <>
                      <textarea
                        defaultValue={item.coach_notes ?? ''}
                        onBlur={(e) => onNotesChange(e.target.value)}
                        rows={2}
                        placeholder="Hinweise für diese Einheit…"
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[13px] text-slate-800"
                      />
                      {!notes ? (
                        <p className="mt-1 text-[12px] text-slate-400">Optional – z. B. Anpassungen für diese Einheit.</p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : notes ? (
                <p className="border-t border-slate-100 px-3 pb-3 pt-0 text-[12px] leading-snug text-slate-600 line-clamp-2">
                  {notes}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200/70 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={onView}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-800 sm:flex-none sm:px-4"
        >
          Ansehen
        </button>
        {!readOnly ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={onReplace}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-800 sm:flex-none sm:px-4 disabled:opacity-50"
            >
              Austauschen
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onRemove}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-3 text-[13px] font-semibold text-red-700 hover:bg-red-50 sm:flex-none sm:px-4 disabled:opacity-50"
            >
              Entfernen
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
