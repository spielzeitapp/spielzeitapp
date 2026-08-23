import React from 'react';
import { X } from 'lucide-react';
import { formatPlayerCountRange, type TrainingExerciseRow } from '../../lib/trainingExercises';
import { EXERCISE_FOCUS_LABELS, TRAINING_PHASE_LABELS } from '../../lib/trainingPhases';
import { TrainingExerciseDetailBlock } from './TrainingExerciseDetailBlock';
import { TrainingExerciseImage } from './TrainingExerciseImage';
import { TrainingExerciseMetaChip } from './TrainingExerciseMetaChip';

function extractVideoUrl(row: TrainingExerciseRow): string | null {
  const candidates = [row.source_reference, row.description, row.organization, row.coaching_points];
  for (const raw of candidates) {
    const text = String(raw ?? '').trim();
    if (!text) continue;
    const match = text.match(/https?:\/\/[^\s<>"']+/i);
    if (match) {
      const url = match[0].replace(/[),.;]+$/, '');
      if (/youtube|youtu\.be|vimeo|\.mp4|video/i.test(url)) return url;
    }
  }
  return null;
}

function detailTexts(row: TrainingExerciseRow): { summary: string | null; flow: string | null } {
  const description = String(row.description ?? '').trim() || null;
  const organization = String(row.organization ?? '').trim();
  if (organization) {
    return { summary: null, flow: description };
  }
  return { summary: description, flow: null };
}

type Props = {
  row: TrainingExerciseRow;
  onClose: () => void;
  /** Optional phase label override (e.g. session item phase). */
  phaseLabel?: string | null;
  footer?: React.ReactNode;
};

export function TrainingExerciseDetailModal({
  row,
  onClose,
  phaseLabel = null,
  footer,
}: Props): React.ReactElement {
  const players = formatPlayerCountRange(row.player_count_min, row.player_count_max);
  const videoUrl = extractVideoUrl(row);
  const { summary, flow } = detailTexts(row);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-detail-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Übung</p>
            <h2 id="exercise-detail-title" className="text-[18px] font-semibold text-slate-900">
              {row.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3">
          <TrainingExerciseImage path={row.image_path} title={row.title} variant="detail" />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <TrainingExerciseMetaChip>{EXERCISE_FOCUS_LABELS[row.focus] ?? row.focus}</TrainingExerciseMetaChip>
          {phaseLabel ? <TrainingExerciseMetaChip tone="phase">{phaseLabel}</TrainingExerciseMetaChip> : null}
          {row.suitable_phases.map((p) => (
            <TrainingExerciseMetaChip key={p}>{TRAINING_PHASE_LABELS[p] ?? p}</TrainingExerciseMetaChip>
          ))}
          <TrainingExerciseMetaChip>{row.duration_minutes} Min.</TrainingExerciseMetaChip>
          {players ? <TrainingExerciseMetaChip>{players}</TrainingExerciseMetaChip> : null}
          {row.age_group ? <TrainingExerciseMetaChip>{row.age_group}</TrainingExerciseMetaChip> : null}
          {row.visibility === 'private' ? (
            <TrainingExerciseMetaChip tone="private">Privat</TrainingExerciseMetaChip>
          ) : (
            <TrainingExerciseMetaChip>Verein</TrainingExerciseMetaChip>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <TrainingExerciseDetailBlock label="Kurzbeschreibung" value={summary} />
          <TrainingExerciseDetailBlock label="Organisation / Aufbau" value={row.organization} />
          <TrainingExerciseDetailBlock label="Ablauf" value={flow} />
          <TrainingExerciseDetailBlock label="Material" value={row.materials} />
          <TrainingExerciseDetailBlock label="Coachingpunkte" value={row.coaching_points} />
          <TrainingExerciseDetailBlock label="Variationen" value={row.variations} />
          {videoUrl ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Video</h3>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex min-h-[40px] items-center text-[13px] font-semibold text-red-700 underline-offset-2 hover:underline"
              >
                Video ansehen
              </a>
            </section>
          ) : null}
          {row.source_reference && !videoUrl ? (
            <TrainingExerciseDetailBlock label="Quelle" value={row.source_reference} />
          ) : null}
        </div>

        {footer ? <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
