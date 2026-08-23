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

const actionButtonClass =
  'inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-[13px] font-semibold touch-manipulation sm:px-3';

function ActionButtons({
  onView,
  onReplace,
  onRemove,
  saving,
  readOnly,
  layout = 'row',
}: {
  onView: () => void;
  onReplace: () => void;
  onRemove: () => void;
  saving: boolean;
  readOnly: boolean;
  layout?: 'row' | 'stack';
}): React.ReactElement {
  const stack = layout === 'stack';
  return (
    <div className={stack ? 'flex min-w-0 flex-col gap-2' : 'grid min-w-0 grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2'}>
      <button
        type="button"
        onClick={onView}
        className={`${actionButtonClass} border border-slate-200 bg-white text-slate-800 ${stack ? 'w-full' : ''}`}
      >
        Ansehen
      </button>
      {!readOnly ? (
        <>
          <button
            type="button"
            disabled={saving}
            onClick={onReplace}
            className={`${actionButtonClass} border border-slate-200 bg-white text-slate-800 disabled:opacity-50 ${stack ? 'w-full' : ''}`}
          >
            Austauschen
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onRemove}
            className={`${actionButtonClass} text-red-700 hover:bg-red-50 disabled:opacity-50 ${stack ? 'w-full' : ''}`}
          >
            Entfernen
          </button>
        </>
      ) : null}
    </div>
  );
}

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
  const title = exercise?.title ?? 'Übung';

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="min-w-0 md:grid md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(148px,176px)]">
        <button
          type="button"
          onClick={onView}
          className="block w-full min-w-0 touch-manipulation p-3 pb-0 md:p-4 md:pb-4"
          aria-label={`${title} ansehen`}
        >
          <TrainingExerciseImage
            path={exercise?.image_path ?? null}
            title={title}
            url={sketchUrl}
            variant="session-card"
          />
        </button>

        <div className="min-w-0 flex flex-col gap-3 p-4 pt-3 md:border-l md:border-slate-100 md:pt-4">
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold leading-snug text-slate-900 md:text-[17px]">{title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
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

          {!readOnly ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] font-medium text-slate-600">
                Dauer
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={item.duration_minutes}
                  onChange={(e) => onDurationChange(Number(e.target.value))}
                  className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-semibold text-slate-900"
                />
                Min.
              </label>
              <div className="flex gap-1.5 lg:hidden">
                <button
                  type="button"
                  disabled={!canMoveUp || saving}
                  onClick={onMoveUp}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] font-semibold disabled:opacity-40"
                  aria-label="Nach oben"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown || saving}
                  onClick={onMoveDown}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] font-semibold disabled:opacity-40"
                  aria-label="Nach unten"
                >
                  ↓
                </button>
              </div>
            </div>
          ) : null}

          {notes || !readOnly ? (
            <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/60">
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-800"
                      />
                      {!notes ? (
                        <p className="mt-1 text-[12px] text-slate-400">
                          Optional – z. B. Anpassungen für diese Einheit.
                        </p>
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

        <div className="hidden min-w-0 flex-col justify-between gap-3 border-l border-slate-100 p-4 lg:flex">
          {!readOnly ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reihenfolge</span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={!canMoveUp || saving}
                  onClick={onMoveUp}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] font-semibold disabled:opacity-40"
                  aria-label="Nach oben"
                >
                  ↑ Hoch
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown || saving}
                  onClick={onMoveDown}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] font-semibold disabled:opacity-40"
                  aria-label="Nach unten"
                >
                  ↓ Runter
                </button>
              </div>
            </div>
          ) : null}
          <ActionButtons
            onView={onView}
            onReplace={onReplace}
            onRemove={onRemove}
            saving={saving}
            readOnly={readOnly}
            layout="stack"
          />
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <ActionButtons
          onView={onView}
          onReplace={onReplace}
          onRemove={onRemove}
          saving={saving}
          readOnly={readOnly}
        />
      </div>
    </article>
  );
}
