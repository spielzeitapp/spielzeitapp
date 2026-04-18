import React from 'react';
import type { NavGlyphProps } from './types';

/**
 * Klassischer Fußball (Telstar): Kreis + Pentagon + gewölbte Nähte bis zum Rand —
 * klar als Ball erkennbar, kein abstraktes „Stern“-Symbol.
 */
export function SoccerBallIcon({ className, strokeWidth = 1.8 }: NavGlyphProps) {
  const w = strokeWidth;
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
      <circle cx="12" cy="12" r="8.05" strokeWidth={w} />
      <path
        d="M12 8.7 15.24 11.09 13.97 14.76 10.03 14.76 8.76 11.09Z"
        strokeWidth={w}
      />
      <path
        d="M12 8.7 Q13.25 6.15 12 3.95M15.24 11.09 Q17.95 10.75 19.76 9.82M13.97 14.76 Q15.95 16.95 16.68 18.55M10.03 14.76 Q8.05 16.95 7.32 18.55M8.76 11.09 Q6.05 10.75 4.24 9.82"
        strokeWidth={w}
      />
    </svg>
  );
}
