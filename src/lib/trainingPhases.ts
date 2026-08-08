/**
 * Trainingsphasen und Übungs-Schwerpunkte (STEP 3A).
 */

export type TrainingPhase = 'AW' | 'HT1' | 'HT2' | 'AK';

export const TRAINING_PHASES: readonly TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK'] as const;

export const TRAINING_PHASE_LABELS: Record<TrainingPhase, string> = {
  AW: 'Aufwärmen',
  HT1: 'Hauptteil 1',
  HT2: 'Hauptteil 2',
  AK: 'Abschlussteil',
};

export const TRAINING_PHASE_SHORT: Record<TrainingPhase, string> = {
  AW: 'AW',
  HT1: 'HT1',
  HT2: 'HT2',
  AK: 'AK',
};

export type ExerciseFocus =
  | 'technik'
  | 'koordination'
  | 'dribbling'
  | 'passspiel'
  | 'ballkontrolle'
  | 'torschuss'
  | 'zweikampf'
  | 'spielform'
  | 'umschalten'
  | 'athletik'
  | 'torwart'
  | 'abschluss'
  | 'other';

export const EXERCISE_FOCUS_LABELS: Record<ExerciseFocus, string> = {
  technik: 'Technik',
  koordination: 'Koordination',
  dribbling: 'Dribbling',
  passspiel: 'Passspiel',
  ballkontrolle: 'Ballkontrolle',
  torschuss: 'Torschuss',
  zweikampf: 'Zweikampf',
  spielform: 'Spielform',
  umschalten: 'Umschalten',
  athletik: 'Athletik',
  torwart: 'Torwart',
  abschluss: 'Abschluss-/Freies Spiel',
  other: 'Sonstiges',
};

export type ExerciseDifficulty = 'easy' | 'medium' | 'hard';

export const EXERCISE_DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  easy: 'Leicht',
  medium: 'Mittel',
  hard: 'Schwer',
};

export type TrainingSessionStatus = 'draft' | 'ready' | 'archived';

export const TRAINING_SESSION_STATUS_LABELS: Record<TrainingSessionStatus, string> = {
  draft: 'Entwurf',
  ready: 'Fertig',
  archived: 'Archiviert',
};

export function isTrainingPhase(v: string): v is TrainingPhase {
  return (TRAINING_PHASES as readonly string[]).includes(v);
}

export function sumPhaseMinutes(
  items: ReadonlyArray<{ phase: TrainingPhase; duration_minutes: number }>,
): Record<TrainingPhase, number> {
  const out: Record<TrainingPhase, number> = { AW: 0, HT1: 0, HT2: 0, AK: 0 };
  for (const row of items) {
    if (isTrainingPhase(row.phase)) out[row.phase] += Math.max(0, row.duration_minutes || 0);
  }
  return out;
}

export function totalSessionMinutes(
  items: ReadonlyArray<{ duration_minutes: number }>,
): number {
  return items.reduce((acc, row) => acc + Math.max(0, row.duration_minutes || 0), 0);
}
