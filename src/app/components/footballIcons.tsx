import React from 'react';

/** Einheitliche Outline-Icons für Nav & Welcome (keine Mix aus Libraries). */
export type FootballIconProps = {
  className?: string;
  strokeWidth?: number;
};

/** Klassischer Fußball: Panel-Nähte, klar als Ball erkennbar (nicht nur Kreis-Punkt). */
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
      <path
        d="M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z"
        strokeWidth={sw}
      />
      <path
        d="m12 7.2 3.35 2.43-1.28 4.1H9.93l-1.28-4.1L12 7.2Z"
        strokeWidth={sw}
      />
      <path
        d="M12 7.2V4.2M7.2 10.8l-2.6 1.1M5.9 16.4l2.5-1.2M18.1 16.4l-2.5-1.2M16.8 10.8l2.6 1.1M8.5 18.6l2.1-1.9M15.5 18.6l-2.1-1.9"
        strokeWidth={sw}
      />
    </svg>
  );
}

/** Spielfeld von oben: Rechteck, Mittellinie, Mittelkreis, zwei Tore angedeutet. */
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
      <rect x="3" y="5" width="18" height="14" rx="1" strokeWidth={sw} />
      <path d="M12 5v14" strokeWidth={sw} />
      <circle cx="12" cy="12" r="3" strokeWidth={sw} />
      <path d="M3 9.5h3.5v5H3M17.5 9.5H21v5h-3.5" strokeWidth={sw} />
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
