import React from 'react';
import { getTrainingPlayerIconSrc } from '../../config/trainingIconVariant';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'w-[92px] min-w-[88px] max-w-[96px] h-auto max-h-[96px]',
  list: 'w-[54px] min-w-[48px] max-w-[58px] h-auto max-h-[58px]',
  compact: 'w-8 max-h-8 h-auto',
};

const glowClass: Record<Variant, string> = {
  hero: 'drop-shadow-[0_0_18px_rgba(122,29,42,0.22),0_0_30px_rgba(255,255,255,0.06)]',
  list: 'drop-shadow-[0_0_8px_rgba(122,29,42,0.1)]',
  compact: 'drop-shadow-[0_0_4px_rgba(122,29,42,0.08)]',
};

/** Training-Spieler als PNG-Asset (Variante a/b über trainingIconVariant.ts). */
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
      className={`shrink-0 object-contain ${glowClass[variant]} ${sizeClass[variant]} ${className}`}
      aria-hidden
      draggable={false}
    />
  );
}
