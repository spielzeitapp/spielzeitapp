import React from 'react';

/** Einheitliche Outline-Icons für Nav & Welcome (keine Mix aus Libraries). */
export type FootballIconProps = {
  className?: string;
  strokeWidth?: number;
};

/**
 * Klassischer Telstar-Look: Kreis + größeres Pentagon + 5 gewölbte Nähte bis zum Rand.
 * Kräftige Linien (über strokeWidth aus der Nav), klar als Fußball lesbar.
 */
export function NavSoccerBallIcon({ className, strokeWidth = 2.15 }: FootballIconProps) {
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
      <circle cx="12" cy="12" r="8.05" strokeWidth={sw} />
      <path
        d="M12 8.7 15.24 11.09 13.97 14.76 10.03 14.76 8.76 11.09Z"
        strokeWidth={sw}
      />
      <path
        d="M12 8.7 Q13.25 6.15 12 3.95M15.24 11.09 Q17.95 10.75 19.76 9.82M13.97 14.76 Q15.95 16.95 16.68 18.55M10.03 14.76 Q8.05 16.95 7.32 18.55M8.76 11.09 Q6.05 10.75 4.24 9.82"
        strokeWidth={sw}
      />
    </svg>
  );
}

/**
 * Spielfeld (Zielbild): Hochformat, größere Fläche im ViewBox, Mittellinie, Mittelkreis, Tore oben/unten.
 */
export function NavSoccerFieldIcon({ className, strokeWidth = 2.15 }: FootballIconProps) {
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
      <rect x="5.85" y="3.15" width="12.3" height="17.7" rx="1.2" strokeWidth={sw} />
      <path d="M5.85 12h12.3" strokeWidth={sw} />
      <circle cx="12" cy="12" r="3.05" strokeWidth={sw} />
      <path d="M8 3.15h8v3.35H8zM8 17.5h8v3.35H8z" strokeWidth={sw} />
    </svg>
  );
}

/** Drei Personen (Team), gleicher Outline-Stil, optisch an Ball/Feld gewichtet. */
export function NavTeamGroupIcon({ className, strokeWidth = 2.15 }: FootballIconProps) {
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
      <circle cx="8.45" cy="8.95" r="2.18" strokeWidth={sw} />
      <circle cx="15.55" cy="8.95" r="2.18" strokeWidth={sw} />
      <circle cx="12" cy="7.45" r="1.92" strokeWidth={sw} />
      <path
        d="M4.45 19.55v-.45c0-1.9 1.42-3.42 3.28-3.62M19.55 19.55v-.45c0-1.9-1.42-3.42-3.28-3.62M12 20.15v-.85c0-2.22-1.52-4.05-3.62-4.45"
        strokeWidth={sw}
      />
    </svg>
  );
}

/** Broadcast / Signal (Live). */
export function NavBroadcastIcon({ className, strokeWidth = 2.15 }: FootballIconProps) {
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
      <circle cx="12" cy="12" r="1.65" fill="currentColor" stroke="none" />
      <path d="M16.15 7.85a6.95 6.95 0 0 1 0 8.3M7.85 7.85a6.95 6.95 0 0 0 0 8.3" strokeWidth={sw} />
      <path d="M18.35 5.65a10.15 10.15 0 0 1 0 12.7M5.65 5.65a10.15 10.15 0 0 0 0 12.7" strokeWidth={sw} />
    </svg>
  );
}

/** Drei Punkte horizontal (Mehr). */
export function NavMoreDotsIcon({ className, strokeWidth = 2.15 }: FootballIconProps) {
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
      <circle cx="6" cy="12" r="1.48" strokeWidth={sw} />
      <circle cx="12" cy="12" r="1.48" strokeWidth={sw} />
      <circle cx="18" cy="12" r="1.48" strokeWidth={sw} />
    </svg>
  );
}
