import React from 'react';
import { getTrainingPlayerIconSrc } from '../../config/trainingIconVariant';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'w-[96px] max-h-[78px] max-w-full h-auto -translate-x-[4px]',
  list: 'w-[60px] max-h-[52px] max-w-full h-auto -translate-x-[4px]',
  compact: 'w-8 max-h-8 h-auto shrink-0',
};

const glowClass: Record<Variant, string> = {
  hero: '[filter:drop-shadow(0_0_10px_rgba(122,29,42,0.14))]',
  list: '[filter:drop-shadow(0_0_6px_rgba(122,29,42,0.08))]',
  compact: '[filter:drop-shadow(0_0_4px_rgba(122,29,42,0.06))]',
};

/** Training-Spieler als transparentes PNG (Variante a/b über trainingIconVariant.ts). */
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
      className={`shrink-0 bg-transparent object-contain ${glowClass[variant]} ${sizeClass[variant]} ${className}`}
      aria-hidden
      draggable={false}
    />
  );
}
