import React from 'react';

type Variant = 'hero' | 'list' | 'compact';

const sizeClass: Record<Variant, string> = {
  hero: 'h-[3.75rem] w-[3.75rem] sm:h-16 sm:w-16',
  list: 'h-10 w-10',
  compact: 'h-8 w-8',
};

/** Stilisierter Spieler mit Ball + dezentes Spielfeld (stroke only, monochrom). */
export function TrainingPlayerIcon({
  variant = 'list',
  className = '',
}: {
  variant?: Variant;
  className?: string;
}) {
  return (
    <svg
      className={`shrink-0 text-white/90 drop-shadow-[0_0_16px_rgba(255,255,255,0.08)] ${sizeClass[variant]} ${className}`}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Spielfeld-Hintergrund */}
      <rect
        x="7"
        y="13"
        width="34"
        height="22"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.2"
      />
      <line x1="24" y1="13" x2="24" y2="35" stroke="currentColor" strokeWidth="1.2" opacity="0.16" />
      <circle cx="24" cy="24" r="3.2" stroke="currentColor" strokeWidth="1.1" opacity="0.14" />
      {/* Ball */}
      <circle cx="35" cy="31" r="3.2" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
      <path
        d="M35 28.2v5.6M32.4 31h5.2"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
        strokeLinecap="round"
      />
      {/* Spieler */}
      <circle cx="21" cy="15.5" r="2.8" stroke="currentColor" strokeWidth="1.85" />
      <path
        d="M21 18.2v7.5M21 21.2l-4.5 6.2M21 23.5l5.5 7.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 19.8l4.2-2.2"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}
