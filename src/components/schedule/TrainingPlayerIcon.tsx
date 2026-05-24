import React from 'react';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'h-[4.9rem] w-[4.9rem] sm:h-[5.45rem] sm:w-[5.45rem]',
  list: 'h-12 w-12',
  compact: 'h-8 w-8',
};

const glowClass: Record<Variant, string> = {
  hero: 'drop-shadow-[0_0_16px_rgba(122,29,42,0.24),0_0_28px_rgba(255,255,255,0.07)]',
  list: 'drop-shadow-[0_0_10px_rgba(122,29,42,0.14)]',
  compact: 'drop-shadow-[0_0_6px_rgba(122,29,42,0.1)]',
};

const STROKE = 2.15;

/**
 * Dynamischer Outline-Fußballspieler mit Ball vor dezentem Spielfeld.
 * Stroke-only, monochrom — freies Motiv ohne Box.
 */
export function TrainingPlayerIcon({
  variant = 'list',
  className = '',
}: {
  variant?: Variant;
  className?: string;
}) {
  return (
    <svg
      className={`shrink-0 text-white/90 ${glowClass[variant]} ${sizeClass[variant]} ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Dezentes Spielfeld */}
      <g opacity="0.11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 48h56" strokeWidth="1" />
        <path d="M32 48V32" strokeWidth="1" />
        <path d="M4 38h16" strokeWidth="1" />
        <path d="M44 38h16" strokeWidth="1" />
        <path d="M4 38v10" strokeWidth="1" />
        <path d="M60 38v10" strokeWidth="1" />
        <circle cx="32" cy="40" r="6" strokeWidth="0.9" />
      </g>

      {/* Ball — klar am Vorderfuß */}
      <circle cx="48.5" cy="43.5" r="4.5" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M48.5 39.2v8.6M45.2 43.5h6.6M46.2 40.8l4.6 5.4M46.2 46.2l4.6-5.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Spieler — nach vorne laufend, sportlich */}
      <circle cx="22" cy="14" r="4" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M22 17.8c0.8 3.2 2.4 7.8 4.2 11.8"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M26.2 29.6l-5.2 16.4"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M26.2 29.6l10.2 13.8"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M24 21.5l-7-2.5"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M25.5 23l8-5"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M26.2 29.6l4.8-3.2"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M30 33.5l14 6"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}
