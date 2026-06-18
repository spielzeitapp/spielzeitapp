/** UI-Vorbereitung Trainings-Challenges — noch ohne DB-Anbindung. */

export type TrainingChallengeTypeId =
  | 'trainingsstarter'
  | 'trainingsprofi'
  | 'trainingsmonster'
  | 'dauerbrenner';

export type TrainingChallengeTypeDefinition = {
  id: TrainingChallengeTypeId;
  title: string;
  emoji: string;
  description: string;
  /** Platzhalter bis Auswertung angebunden ist. */
  placeholderHint: string;
};

export const TRAINING_CHALLENGE_TYPES: TrainingChallengeTypeDefinition[] = [
  {
    id: 'trainingsstarter',
    title: 'Trainingsstarter',
    emoji: '🚀',
    description: 'Regelmäßig beim Team-Training dabei sein.',
    placeholderHint: 'Demnächst verfügbar',
  },
  {
    id: 'trainingsprofi',
    title: 'Trainingsprofi',
    emoji: '⭐',
    description: 'Hohe Trainingsquote über die Saison halten.',
    placeholderHint: 'Demnächst verfügbar',
  },
  {
    id: 'trainingsmonster',
    title: 'Trainingsmonster',
    emoji: '🔥',
    description: 'Maximale Aktivität inkl. LAZ-Einheiten.',
    placeholderHint: 'Demnächst verfügbar',
  },
  {
    id: 'dauerbrenner',
    title: 'Dauerbrenner',
    emoji: '💪',
    description: 'Längste ununterbrochene Trainingsserie.',
    placeholderHint: 'Demnächst verfügbar',
  },
];

export type TrainingStreakSnapshot = {
  currentStreak: number | null;
  seasonBestStreak: number | null;
};

/** Platzhalter bis Serien-Auswertung angebunden ist. */
export const EMPTY_TRAINING_STREAK: TrainingStreakSnapshot = {
  currentStreak: null,
  seasonBestStreak: null,
};
