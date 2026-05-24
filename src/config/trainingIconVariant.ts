export const TRAINING_ICON_VARIANT = 'b';

export type TrainingIconVariant = 'a' | 'b';

const TIGHT_ICON = 'icons/training-player-tight.png';

/** Eng gecropptes Training-Icon; Fallback a/b nur für manuelle Tests. */
export function getTrainingPlayerIconSrc(): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${base}${TIGHT_ICON}`;
}

/** Legacy-Fallback (Varianten-Vergleich). */
export function getTrainingPlayerIconSrcVariant(variant: TrainingIconVariant): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  if (variant === 'b') {
    return `${base}icons/training-player-b.png`;
  }
  return `${base}icons/training-player-a.png`;
}
