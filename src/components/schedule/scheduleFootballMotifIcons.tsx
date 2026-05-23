import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';

/** Trainings-Motiv: Spielfeld-Lineicon + Kegel (BottomNav-Linienstärke). */
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
        x="3"
        y="5"
        width="18"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16.5 18.5L17.5 16h1.4l1 2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17.5 16v1.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
