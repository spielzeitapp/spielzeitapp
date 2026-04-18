import React from 'react';
import type { NavGlyphProps } from './types';

/** Live / Signal: Punkt + Bögen — gleiche Formsprache wie die übrigen Nav-Glyphen. */
export function BroadcastIcon({ className, strokeWidth = 1.8 }: NavGlyphProps) {
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
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M16.2 7.8a7 7 0 0 1 0 8.4M7.8 7.8a7 7 0 0 0 0 8.4" strokeWidth={sw} />
      <path d="M18.4 5.6a10.2 10.2 0 0 1 0 12.8M5.6 5.6a10.2 10.2 0 0 0 0 12.8" strokeWidth={sw} />
    </svg>
  );
}
