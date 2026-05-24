import React from 'react';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'h-[4.25rem] w-[4.25rem] sm:h-[4.75rem] sm:w-[4.75rem]',
  list: 'h-11 w-11',
  compact: 'h-8 w-8',
};

const STROKE = 1.9;

/**
 * Dynamischer Fußballspieler mit Ball vor dezentem Spielfeld.
 * Stroke-only, monochrom — kein Kästchen, kein Stickman.
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
      className={`shrink-0 text-white/90 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] ${sizeClass[variant]} ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Dezentes Spielfeld — feine Linien, sehr niedrige Opacity */}
      <g opacity="0.14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 46h52" strokeWidth="1.1" />
        <path d="M32 46V30" strokeWidth="1.1" />
        <path d="M6 36h14" strokeWidth="1.1" />
        <path d="M44 36h14" strokeWidth="1.1" />
        <path d="M6 36v10" strokeWidth="1.1" />
        <path d="M58 36v10" strokeWidth="1.1" />
        <circle cx="32" cy="38" r="5.5" strokeWidth="1" />
      </g>

      {/* Ball */}
      <circle cx="46" cy="42" r="4.2" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M46 38.4v7.2M43.2 42h5.6M44.2 39.8l3.6 4.4M44.2 44.2l3.6-4.4"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* Spieler — dynamische Lauf-/Dribbling-Pose */}
      <circle cx="26" cy="13.5" r="3.8" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M26 17.2c1.2 2.8 3.8 8.2 5.2 12.2"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M31.2 29.4l-6.8 14.2"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M31.2 29.4l8.4 12.6"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M27.5 20.5l-5.5-3.2"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M28.5 22.5l6.5-4.5"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M31.2 29.4l2.8-2.2"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}
