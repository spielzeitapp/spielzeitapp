import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';

/** Gleiche Formsprache wie BottomNav `pitch.svg` (horizontal, Mittelkreis, Strafraum). */
export function PitchNavIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="2.25"
        y="4.25"
        width="19.5"
        height="15.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="12" y1="4.25" x2="12" y2="19.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect
        x="2.25"
        y="8.1"
        width="4.25"
        height="7.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="17.5"
        y="8.1"
        width="4.25"
        height="7.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Trainings-Motiv = BottomNav-Spielfeld (Premium Line). */
export function TrainingMotifIcon({ className = '' }: { className?: string }) {
  return <PitchNavIcon className={className} />;
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
