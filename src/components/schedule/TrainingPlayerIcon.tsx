import React from 'react';
import { getTrainingPlayerIconSrc } from '../../config/trainingIconVariant';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'h-[78px] w-[78px] min-h-[74px] min-w-[74px] max-h-[82px] max-w-[82px]',
  list: 'h-[46px] w-[46px] min-h-[42px] min-w-[42px] max-h-[48px] max-w-[48px]',
  compact: 'h-8 w-8 max-h-8 max-w-8',
};

/** Nur subtiler roter Outer-Glow — kein Container, kein Hintergrund. */
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
