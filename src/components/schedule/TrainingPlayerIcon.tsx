import React from 'react';
import { getTrainingPlayerIconSrc } from '../../config/trainingIconVariant';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'h-[78px] w-[78px] shrink-0 object-contain',
  list: 'h-[48px] w-[48px] shrink-0 object-contain',
  compact: 'h-8 w-8 max-h-8 max-w-8 shrink-0 object-contain',
};

const glowClass: Record<Variant, string> = {
  hero: '[filter:drop-shadow(0_0_14px_rgba(122,29,42,0.22))]',
  list: '[filter:drop-shadow(0_0_10px_rgba(122,29,42,0.16))]',
  compact: '[filter:drop-shadow(0_0_4px_rgba(122,29,42,0.06))]',
};

/** Training-Spieler — Hero/Liste als normale Grid-Spalte. */
export function TrainingPlayerIcon({
  variant = 'list',
  className = '',
}: {
  variant?: Variant;
  className?: string;
}) {
  return (
    <img
      src={getTrainingPlayerIconSrc()}
      alt=""
      className={`bg-transparent ${glowClass[variant]} ${sizeClass[variant]} ${className}`}
      aria-hidden
      draggable={false}
    />
  );
}
