import React from 'react';
import {
  getTrainingPlayerHeroSrc,
  getTrainingPlayerListSrc,
  getTrainingPlayerIconSrc,
} from '../../config/trainingIconVariant';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'w-[78px] h-auto shrink-0 object-contain ml-1 mr-2',
  list: 'w-[54px] h-auto shrink-0 object-contain',
  compact: 'h-8 w-8 max-h-8 max-w-8 shrink-0 object-contain',
};

const glowClass: Record<Variant, string> = {
  hero: '[filter:drop-shadow(0_0_14px_rgba(122,29,42,0.22))]',
  list: '[filter:drop-shadow(0_0_10px_rgba(122,29,42,0.16))]',
  compact: '[filter:drop-shadow(0_0_4px_rgba(122,29,42,0.06))]',
};

function srcForVariant(variant: Variant): string {
  if (variant === 'hero') return getTrainingPlayerHeroSrc();
  if (variant === 'list') return getTrainingPlayerListSrc();
  return getTrainingPlayerIconSrc();
}

/** Training-Spieler — fitted Assets für Hero/Liste. */
export function TrainingPlayerIcon({
  variant = 'list',
  className = '',
}: {
  variant?: Variant;
  className?: string;
}) {
  return (
    <img
      src={srcForVariant(variant)}
      alt=""
      className={`bg-transparent ${glowClass[variant]} ${sizeClass[variant]} ${className}`}
      aria-hidden
      draggable={false}
    />
  );
}
