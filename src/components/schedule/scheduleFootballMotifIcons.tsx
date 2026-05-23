import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';

const TRAINING_STROKE = 1.85;

/** Trainings-Motiv: ruhiges Spielfeld + Kegel (Premium Line, BottomNav-Sprache). */
export function TrainingMotifIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3.25"
        y="5.25"
        width="17.5"
        height="11.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth={TRAINING_STROKE}
        strokeLinejoin="round"
      />
      <path d="M12 5.25v11.5" stroke="currentColor" strokeWidth={TRAINING_STROKE} strokeLinecap="round" />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth={TRAINING_STROKE} />
      <path
        d="M16.75 18.25L17.65 16.15h1.25l.95 2.1"
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
