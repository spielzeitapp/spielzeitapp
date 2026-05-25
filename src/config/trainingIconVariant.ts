export const TRAINING_ICON_VARIANT = 'b';

export type TrainingIconVariant = 'a' | 'b';

const HERO_FIT_ICON = 'icons/training-player-hero-fit.png';
const LIST_FIT_ICON = 'icons/training-player-list-fit.png';
const TIGHT_ICON = 'icons/training-player-tight.png';

function basePath(): string {
  return (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
}

export function getTrainingPlayerHeroSrc(): string {
  return `${basePath()}${HERO_FIT_ICON}`;
}

export function getTrainingPlayerListSrc(): string {
  return `${basePath()}${LIST_FIT_ICON}`;
}

/** Eng gecropptes Training-Icon (Legacy/Fallback). */
export function getTrainingPlayerIconSrc(): string {
  return `${basePath()}${TIGHT_ICON}`;
}

/** Legacy-Fallback (Varianten-Vergleich). */
export function getTrainingPlayerIconSrcVariant(variant: TrainingIconVariant): string {
  if (variant === 'b') {
    return `${basePath()}icons/training-player-b.png`;
  }
  return `${basePath()}icons/training-player-a.png`;
}
