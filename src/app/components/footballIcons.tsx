import React from 'react';

/** Einheitliche Outline-Icons für Nav & Welcome (keine Mix aus Libraries). */
export type FootballIconProps = {
  className?: string;
  strokeWidth?: number;
};

/**
 * Klassischer Panel-Fußball: Kreis + zentrales Pentagon + leicht gewölbte Nähte (keine geraden Speichen).
 * Wirkt in 24px klar als Ball, nicht als technisches Rad-/Segment-Icon.
 */
export function NavSoccerBallIcon({ className, strokeWidth = 2 }: FootballIconProps) {
  const sw = strokeWidth;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.15" strokeWidth={sw} />
      <path
        d="M12 8.95 14.9 11.06 13.79 14.47 10.21 14.47 9.1 11.06Z"
        strokeWidth={sw}
      />
      <path
        d="M12 8.95 Q13.1 6.35 12 3.85M14.9 11.06 Q17.85 10.55 19.72 9.45M13.79 14.47 Q16.15 17.05 16.78 18.62M10.21 14.47 Q7.85 17.05 7.22 18.62M9.1 11.06 Q6.15 10.55 4.28 9.45"
        strokeWidth={sw}
      />
    </svg>
  );
}

/**
 * Spielfeld (Zielbild): Hochformat, Mittellinie waagerecht, Mittelkreis, kleine Torräume oben/unten.
 */
export function NavSoccerFieldIcon({ className, strokeWidth = 2 }: FootballIconProps) {
  const sw = strokeWidth;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="7" y="3.75" width="10" height="16.5" rx="1.05" strokeWidth={sw} />
      <path d="M7 12h10" strokeWidth={sw} />
      <circle cx="12" cy="12" r="2.65" strokeWidth={sw} />
      <path d="M9 3.75h6v2.6H9zM9 17.65h6v2.6H9z" strokeWidth={sw} />
    </svg>
  );
}

/** Drei Personen (Team), gleicher Outline-Stil. */
export function NavTeamGroupIcon({ className, strokeWidth = 2 }: FootballIconProps) {
  const sw = strokeWidth;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8.5" cy="9" r="2.1" strokeWidth={sw} />
      <circle cx="15.5" cy="9" r="2.1" strokeWidth={sw} />
      <circle cx="12" cy="7.6" r="1.85" strokeWidth={sw} />
      <path
        d="M4.5 19.6v-.45c0-1.9 1.4-3.45 3.25-3.65M19.5 19.6v-.45c0-1.9-1.4-3.45-3.25-3.65M12 20.2v-.85c0-2.25-1.55-4.1-3.65-4.5"
        strokeWidth={sw}
      />
    </svg>
  );
}

/** Broadcast / Signal (Live). */
export function NavBroadcastIcon({ className, strokeWidth = 2 }: FootballIconProps) {
  const sw = strokeWidth;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
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

/** Drei Punkte horizontal (Mehr). */
export function NavMoreDotsIcon({ className, strokeWidth = 2 }: FootballIconProps) {
  const sw = strokeWidth;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6" cy="12" r="1.35" strokeWidth={sw} />
      <circle cx="12" cy="12" r="1.35" strokeWidth={sw} />
      <circle cx="18" cy="12" r="1.35" strokeWidth={sw} />
    </svg>
  );
}
