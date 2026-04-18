import React from 'react';
import type { NavGlyphProps } from './types';

/** Spielfeld von oben — groß im ViewBox, optisch vergleichbar mit dem Ball. */
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
      <rect x="2.25" y="4.25" width="19.5" height="15.5" rx="2" strokeWidth={sw} />
      <line x1="12" y1="4.25" x2="12" y2="19.75" strokeWidth={sw} />
      <circle cx="12" cy="12" r="2.9" strokeWidth={sw} />
      <rect x="2.25" y="8.1" width="4.25" height="7.8" strokeWidth={sw} />
      <rect x="17.5" y="8.1" width="4.25" height="7.8" strokeWidth={sw} />
    </svg>
  );
}
