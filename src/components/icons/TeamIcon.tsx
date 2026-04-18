import React from 'react';
import type { NavGlyphProps } from './types';

/** Drei Figuren — skaliert für ähnliche optische Fläche wie Ball/Spielfeld, Strich 1.8. */
export function TeamIcon({ className, strokeWidth = 1.8 }: NavGlyphProps) {
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
      <circle cx="12" cy="8.55" r="2.38" strokeWidth={sw} />
      <path d="M7.65 15.35c1.45-2.15 7.25-2.15 8.7 0" strokeWidth={sw} />

      <circle cx="7.15" cy="9.65" r="1.98" strokeWidth={sw} />
      <path d="M4.05 15.35c0.95-1.65 4.15-1.95 5.15-0.55" strokeWidth={sw} />

      <circle cx="16.85" cy="9.65" r="1.98" strokeWidth={sw} />
      <path d="M14.1 15c1.05-1.45 4.05-1.15 4.95 0.45" strokeWidth={sw} />
    </svg>
  );
}
