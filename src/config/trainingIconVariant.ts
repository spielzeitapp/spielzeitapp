export const TRAINING_ICON_VARIANT = 'b';

export type TrainingIconVariant = 'a' | 'b';

export function getTrainingPlayerIconSrc(
  variant: TrainingIconVariant = TRAINING_ICON_VARIANT as TrainingIconVariant,
): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  if (variant === 'b') {
    return `${base}icons/training-player-b.png`;
  }
  return `${base}icons/training-player-a.png`;
}
