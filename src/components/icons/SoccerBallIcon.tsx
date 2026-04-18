import React from 'react';
import type { NavGlyphProps } from './types';

/** Klassischer Fußball: Umriss + gefülltes Pentagon, Nähte — Mockup-Stärke ~1,8 / Detail ~2/3. */
export function SoccerBallIcon({ className, strokeWidth = 1.8 }: NavGlyphProps) {
  const w = strokeWidth;
  const wDetail = Math.max(1, w * (1.2 / 1.8));
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
      <circle cx="12" cy="12" r="9" strokeWidth={w} />
      <polygon points="12,7.3 14.6,9.1 13.7,12.1 10.3,12.1 9.4,9.1" fill="currentColor" stroke="none" />
      <path
        d="M12 7.3L9.4 9.1M12 7.3L14.6 9.1M10.3 12.1L8 13.8M13.7 12.1L16 13.8M8 13.8L9.6 16.6M16 13.8L14.4 16.6M9.6 16.6H14.4"
        strokeWidth={wDetail}
      />
    </svg>
  );
}
