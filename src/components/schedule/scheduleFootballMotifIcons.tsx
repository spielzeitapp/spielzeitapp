import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';

/** Trainings-Motiv: monochromes Taktikboard + Kegel (Premium Football UI). */
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
        x="3.5"
        y="5"
        width="17"
        height="11.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.35"
        className="text-white/28"
      />
      <path d="M12 5v11.5M3.5 10.75h17" stroke="currentColor" strokeWidth="0.9" className="text-white/14" />
      <circle cx="12" cy="10.75" r="1.35" stroke="currentColor" strokeWidth="1" className="text-white/22" />
      <path
        d="M6.25 18.25L7.35 15.1h1.8L10.25 18.25"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        className="text-white/78"
      />
      <path d="M7.35 15.1v1.35" stroke="currentColor" strokeWidth="1" className="text-[#ff909b]/75" />
      <path
        d="M13.75 18.25L14.85 15.1h1.8L17.75 18.25"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        className="text-white/78"
      />
      <path d="M14.85 15.1v1.35" stroke="currentColor" strokeWidth="1" className="text-[#ff909b]/75" />
      <path
        d="M17.25 7.25c.55-.85 1.55-1.35 2.55-1.2"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        className="text-white/42"
      />
      <circle cx="18.85" cy="6.35" r="0.85" fill="currentColor" className="text-[#ff909b]/88" />
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

/** Kompaktliste Training: monochromes Drill-Icon. */
export function CompactFootballBallIcon({ className = '' }: { className?: string }) {
  return <TrainingMotifIcon className={className} />;
}
