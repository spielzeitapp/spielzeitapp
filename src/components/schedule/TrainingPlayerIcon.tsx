import React from 'react';
import { getTrainingPlayerIconSrc } from '../../config/trainingIconVariant';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'ml-[10px] mr-4 h-[62px] w-[62px] shrink-0 object-contain opacity-[0.92]',
  list: 'h-auto w-[46px] max-h-[46px] max-w-[46px] shrink-0 object-contain opacity-90',
  compact: 'h-8 w-8 max-h-8 max-w-8 shrink-0 object-contain',
};

const glowClass: Record<Variant, string> = {
  hero: '[filter:drop-shadow(0_0_10px_rgba(122,29,42,0.14))]',
  list: '[filter:drop-shadow(0_0_6px_rgba(122,29,42,0.08))]',
  compact: '[filter:drop-shadow(0_0_4px_rgba(122,29,42,0.06))]',
};

/** Training-Spieler — tight-crop PNG; Hero/Liste als normale Flex/Grid-Spalte. */
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
