import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';

const TRAINING_STROKE = 2;

/** Trainings-Motiv: vertikales Spielfeld + Kegel (Premium Line, BottomNav-Sprache). */
export function TrainingMotifIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="9"
        y="5"
        width="14"
        height="22"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={TRAINING_STROKE}
        strokeLinejoin="round"
      />
      <path d="M16 5v22" stroke="currentColor" strokeWidth={TRAINING_STROKE} strokeLinecap="round" />
      <path
        d="M22.5 26.5 23.75 23h2.1l1.15 3.5"
        stroke="currentColor"
        strokeWidth={TRAINING_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Spiel ohne Logos: Ball + Rasenlinien. */
export function MatchFallbackMotifIcon({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <LayoutGrid className="absolute h-full w-full text-white/[0.07]" strokeWidth={1} aria-hidden />
      <div className="relative flex h-[70%] w-[70%] items-center justify-center rounded-full border border-white/20 bg-white/10">
        <div className="h-1/2 w-1/2 rounded-full bg-white/85" />
      </div>
    </div>
  );
}

export function EventMotifIcon({ className = '' }: { className?: string }) {
  return <CalendarDays className={className} strokeWidth={2} aria-hidden />;
}

/** Kompaktliste Training: gleiches Feld-Icon. */
export function CompactFootballBallIcon({ className = '' }: { className?: string }) {
  return <TrainingMotifIcon className={className} />;
}
