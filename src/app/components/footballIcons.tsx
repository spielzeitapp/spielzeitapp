import React from 'react';

/** Einheitliche Outline-Icons für Nav & Welcome (keine Mix aus Libraries). */
export type FootballIconProps = {
  className?: string;
  strokeWidth?: number;
};

/**
 * Klassischer Telstar-/Panel-Look: Kreis + zentrales Pentagon + Nähte entlang der Strahlen.
 * In 24px gut lesbar, ohne verspielte Kurven — klar „Fußball“, nicht Rad/Segment-Icon.
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
      {/* Reguläres Zentrumspolygon (Telstar-typisch), Spitze nach oben */}
      <path
        d="M12 8.95 14.9 11.06 13.79 14.47 10.21 14.47 9.1 11.06Z"
        strokeWidth={sw}
      />
      {/* Nähte bis zum Außenkreis, entlang der Eck-Richtung vom Mittelpunkt */}
      <path
        d="M12 8.95V3.85M14.9 11.06l4.87-1.58M13.79 14.47l3 4.14M10.21 14.47l-3 4.14M9.1 11.06l-4.87-1.58"
        strokeWidth={sw}
      />
    </svg>
  );
}

/** Spielfeld von oben: Rand, Mittellinie, Mittelkreis, Tore als klar erkennbare Kästen. */
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
      <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="1.15" strokeWidth={sw} />
      <path d="M12 5.25v13.5" strokeWidth={sw} />
      <circle cx="12" cy="12" r="2.85" strokeWidth={sw} />
      {/* Torraum links / rechts (von der Grundlinie ins Feld) */}
      <path d="M3.25 9h4.25v6H3.25M16.5 9h4.25v6H16.5" strokeWidth={sw} />
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
