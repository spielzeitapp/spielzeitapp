import React from "react";

type IconProps = { className?: string };

const deco = "h-16 w-16 text-red-500/[0.14]";

export function StatIconPitch({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="2.25" y="4.25" width="19.5" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <line x1="12" y1="4.25" x2="12" y2="19.75" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.9" stroke="currentColor" strokeWidth="1.8" />
      <rect x="2.25" y="8.1" width="4.25" height="7.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="17.5" y="8.1" width="4.25" height="7.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function StatIconFootball({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 4.2l2.1 3.2 3.7.5-2.7 2.6.6 3.7-3.3-1.7-3.3 1.7.6-3.7-2.7-2.6 3.7-.5L12 4.2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatIconAssist({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="16.5" cy="6.5" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6 20c1.2-4.2 4.5-7.2 8.8-8.2M5 14l2.5 2.5M5 14l2-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 17.5c-2.8-3.5-2.5-8.5 1.5-10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatIconStopwatch({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="13" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 9v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 3.5h4M12 3.5v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function StatIconTrophy({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M8 4h8v3.5c0 2.2-1.4 4.1-3.5 4.8V14H15v2H9v-2h2.5v-1.7C9.4 11.6 8 9.7 8 7.5V4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M6 4H5a2 2 0 0 0-2 2v1c0 1.7 1.3 3 3 3M18 4h1a2 2 0 0 1 2 2v1c0 1.7-1.3 3-3 3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 18h6v2H9v-2z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function StatIconChart({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 4.8v3.2M12 16v3.2M4.8 12h3.2M16 12h3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function StatIconTraining({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="8.2" r="2.35" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.2 15.8c1.5-2.2 8.1-2.2 9.6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17.2" cy="14.5" r="2.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15.5 12.8l-1.8 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function StatIconGoalkeeper({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="7.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M6.5 11.5 4 20h16l-2.5-8.5M9 14.5h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 14.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function StatIconStar({ className = deco }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="m12 4.2 1.55 4.75h4.9l-3.95 2.9 1.5 4.75L12 13.7l-3 2.9 1.5-4.75-3.95-2.9h4.9L12 4.2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const PLAYER_STAT_TILES = {
  games: StatIconPitch,
  goals: StatIconFootball,
  assists: StatIconAssist,
  minutes: StatIconStopwatch,
  deployments: StatIconTrophy,
  goalsPerGame: StatIconChart,
} as const;

export const COACH_STAT_TILES = {
  trainings: StatIconTraining,
  games: StatIconPitch,
  wins: StatIconTrophy,
  goalsFor: StatIconFootball,
  goalsAgainst: StatIconGoalkeeper,
  pointsPerGame: StatIconStar,
} as const;
