import React from 'react';
import { getTrainingPlayerIconSrc } from '../../config/trainingIconVariant';

type Variant = 'hero' | 'list' | 'compact' | 'hero-watermark' | 'list-watermark';

const sizeClass: Record<Variant, string> = {
  hero: 'ml-2 mr-[14px] h-auto w-[96px] max-h-[78px] max-w-[96px] shrink-0',
  list: 'h-auto w-[58px] max-h-[48px] max-w-[58px] shrink-0',
  compact: 'h-8 w-8 max-h-8 max-w-8 shrink-0',
  'hero-watermark':
    'pointer-events-none absolute left-[145px] top-[22px] z-[1] h-auto w-[96px] max-w-[96px] object-contain object-left opacity-[0.55]',
  'list-watermark':
    'pointer-events-none absolute left-0 top-1/2 z-0 h-auto w-[54px] max-w-[54px] -translate-y-1/2 object-contain object-left opacity-[0.65]',
};

const glowClass: Record<Variant, string> = {
  hero: '[filter:drop-shadow(0_0_10px_rgba(122,29,42,0.14))]',
  list: '[filter:drop-shadow(0_0_6px_rgba(122,29,42,0.08))]',
  compact: '[filter:drop-shadow(0_0_4px_rgba(122,29,42,0.06))]',
  'hero-watermark': '',
  'list-watermark': '',
};

/** Training-Spieler — tight-crop PNG; Watermark-Varianten für Hero/Liste. */
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
