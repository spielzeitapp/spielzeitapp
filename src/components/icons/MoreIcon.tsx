import React from 'react';
import type { NavGlyphProps } from './types';

/** Drei Punkte, gefüllt — etwas kräftiger für gleiche visuelle Gewichtung bei 26px. */
export function MoreIcon({ className }: NavGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="6" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="18" cy="12" r="1.75" />
    </svg>
  );
}
