import React from 'react';

export type LeibchenJerseyVariant = 'field' | 'goalkeeper';
export type LeibchenJerseySize = 'large' | 'compact';

export type LeibchenJerseyProps = {
  /** Familienname (wird zentriert in Großbuchstaben angezeigt) */
  lastName: string;
  /** Rückennummer */
  number: string | number | null | undefined;
  /** Positionskürzel (z. B. GK, ZM) */
  position: string;
  variant: LeibchenJerseyVariant;
  size?: LeibchenJerseySize;
  /** Ausgewählt: roter Außen-Glow wie im Zielbild */
  selected?: boolean;
  className?: string;
};

const STRIPE_RED = '#dc2626';
const STRIPE_BLACK = '#0a0a0a';
const SLEEVE_BLACK = '#111827';
const GK_GREEN_TOP = '#22c55e';
const GK_GREEN_BOTTOM = '#15803d';

/**
 * Leibchen (Rückenansicht) als SVG — Struktur wie Zielbild:
 * Familienname oben, Nummer groß mittig, Position unten.
 * Feldspieler: rot/schwarz gestreifter Torso; Ärmel schwarz mit rotem Saum; Kragen schwarz.
 * Torwart: einheitlich grün mit leichter Tiefenwirkung.
 */
export function LeibchenJersey({
  lastName,
  number,
  position,
  variant,
  size = 'large',
  selected = false,
  className = '',
}: LeibchenJerseyProps): React.ReactElement {
  const nameDisplay = lastName.trim().toUpperCase();
  const numDisplay = number === null || number === undefined || number === '' ? '–' : String(number);
  const posDisplay = position.trim().toUpperCase();

  const sizeClass = size === 'large' ? 'h-[7.25rem] w-[5.75rem]' : 'h-[4.75rem] w-[3.75rem]';

  const safeId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const patternId = `lj-stripes-${safeId}`;
  const gkGradId = `lj-gk-${safeId}`;
  const clipTorsoId = `lj-torso-${safeId}`;
  const selFilterId = `lj-sel-${safeId}`;

  const ariaLabel = `${nameDisplay} Nummer ${numDisplay} Position ${posDisplay}${variant === 'goalkeeper' ? ', Torwart' : ''}`;

  return (
    <svg
      viewBox="0 0 100 118"
      className={`shrink-0 ${sizeClass} ${className}`.trim()}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="10" height="118" x="0" y="0">
          <rect width="5" height="118" fill={STRIPE_RED} />
          <rect x="5" width="5" height="118" fill={STRIPE_BLACK} />
        </pattern>
        <linearGradient id={gkGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GK_GREEN_TOP} />
          <stop offset="100%" stopColor={GK_GREEN_BOTTOM} />
        </linearGradient>
        <clipPath id={clipTorsoId}>
          <path d="M 50 10.5 C 44 10.5 38.5 12 34 15 L 30 18.5 Q 28 20 28 23 L 28 104 Q 28 108 32 109.5 L 68 109.5 Q 72 108 72 104 L 72 23 Q 72 20 70 18.5 L 66 15 C 61.5 12 56 10.5 50 10.5 Z" />
        </clipPath>
        {selected ? (
          <filter id={selFilterId} x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#ef4444" floodOpacity="0.95" />
            <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#dc2626" floodOpacity="0.55" />
          </filter>
        ) : null}
      </defs>

      <g filter={selected ? `url(#${selFilterId})` : undefined}>
        {/* Ärmel: Feld schwarz mit rotem Saum; Torwart wie Torso grün */}
        <path
          d="M 28 22 L 14 28 Q 10 30 9.5 34 L 8 48 Q 7.5 52 10 54.5 L 22 50 Q 24 49 25 46 L 27 24 Q 27.5 22 28 22 Z"
          fill={variant === 'field' ? SLEEVE_BLACK : `url(#${gkGradId})`}
          stroke={variant === 'field' ? STRIPE_RED : '#14532d'}
          strokeWidth="0.85"
          strokeLinejoin="round"
        />
        <path
          d="M 72 22 L 86 28 Q 90 30 90.5 34 L 92 48 Q 92.5 52 90 54.5 L 78 50 Q 76 49 75 46 L 73 24 Q 72.5 22 72 22 Z"
          fill={variant === 'field' ? SLEEVE_BLACK : `url(#${gkGradId})`}
          stroke={variant === 'field' ? STRIPE_RED : '#14532d'}
          strokeWidth="0.85"
          strokeLinejoin="round"
        />

        {/* Torso: Streifen oder Torwart-Grün */}
        {variant === 'field' ? (
          <g clipPath={`url(#${clipTorsoId})`}>
            <rect x="0" y="0" width="100" height="118" fill={`url(#${patternId})`} />
          </g>
        ) : (
          <path
            d="M 50 10.5 C 44 10.5 38.5 12 34 15 L 30 18.5 Q 28 20 28 23 L 28 104 Q 28 108 32 109.5 L 68 109.5 Q 72 108 72 104 L 72 23 Q 72 20 70 18.5 L 66 15 C 61.5 12 56 10.5 50 10.5 Z"
            fill={`url(#${gkGradId})`}
            stroke="#14532d"
            strokeWidth="0.5"
          />
        )}

        {/* Kragen */}
        <path
          d="M 50 10.5 C 46 10.5 42 11.2 39 13 L 37 14.5 Q 36.2 15.2 36.8 16.2 L 38.5 17.8 Q 42 16.2 50 16.2 Q 58 16.2 61.5 17.8 L 63.2 16.2 Q 63.8 15.2 63 14.5 L 61 13 C 58 11.2 54 10.5 50 10.5 Z"
          fill={variant === 'field' ? SLEEVE_BLACK : '#14532d'}
        />

        {/* Text: Familienname — Nummer — Position (exakt vertikal, zentriert) */}
        <text
          x="50"
          y="38"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
          fontSize="7.2"
          fontWeight="700"
          letterSpacing="0.06em"
        >
          {nameDisplay}
        </text>
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
          fontSize="26"
          fontWeight="800"
          dominantBaseline="middle"
        >
          {numDisplay}
        </text>
        <text
          x="50"
          y="94"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
          fontSize="7.2"
          fontWeight="700"
          letterSpacing="0.12em"
        >
          {posDisplay}
        </text>
      </g>
    </svg>
  );
}
