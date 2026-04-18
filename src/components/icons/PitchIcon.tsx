import React from 'react';
import type { NavGlyphProps } from './types';

/** Spielfeld von oben: Außenlinie, Mittellinie, Mittelkreis, Torräume — einheitliche Strichstärke. */
export function PitchIcon({ className, strokeWidth = 1.8 }: NavGlyphProps) {
  const sw = strokeWidth;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={sw} />
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth={sw} />
      <circle cx="12" cy="12" r="2.2" strokeWidth={sw} />
      <rect x="3" y="9" width="3" height="6" strokeWidth={sw} />
      <rect x="18" y="9" width="3" height="6" strokeWidth={sw} />
    </svg>
  );
}
