import React from 'react';
import type { NavGlyphProps } from './types';

/** Drei Figuren, eine zentral vorn — gleiche Strichstärke, ohne Transparenz-Mix. */
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
      <circle cx="12" cy="9" r="2.2" strokeWidth={sw} />
      <path d="M8.5 15c1.2-2 5.8-2 7 0" strokeWidth={sw} />

      <circle cx="7" cy="10" r="1.8" strokeWidth={sw} />
      <path d="M4.5 15c0.8-1.5 3.5-1.8 4.5-0.5" strokeWidth={sw} />

      <circle cx="17" cy="10" r="1.8" strokeWidth={sw} />
      <path d="M15 14.5c1-1.3 3.7-1 4.5 0.5" strokeWidth={sw} />
    </svg>
  );
}
