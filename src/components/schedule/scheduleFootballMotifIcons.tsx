import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';

/** Trainings-Motiv: Kegel + Ball (kein Hantel-Icon). */
export function TrainingMotifIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M6 19L4 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="text-amber-400" />
      <path d="M9 17L7 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="text-amber-400" />
      <path d="M4 17L6 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="text-amber-400" />
      <circle cx="16" cy="9" r="4.25" fill="currentColor" className="text-white/90" opacity="0.95" />
      <path
        d="M14.2 7.3c.9.35 1.55 1.15 1.75 2.1M17.8 10.6c-.2.95-.85 1.75-1.75 2.1"
        stroke="currentColor"
        strokeWidth="0.9"
        className="text-zinc-900/55"
        strokeLinecap="round"
      />
      <rect
        x="2"
        y="18.5"
        width="20"
        height="1.2"
        rx="0.4"
        fill="currentColor"
        className="text-emerald-500/35"
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

/** Kompaktliste Training: einfacher Fußball (56px-tauglich). */
export function CompactFootballBallIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" className="text-white/[0.93]" />
      <path
        fill="currentColor"
        className="text-zinc-900/50"
        d="M12 4.5c1.2 0 2.3.3 3.3.8l-1 2.4 2.6 1.2 2.7-.9c.3.6.5 1.2.6 1.9l-2.3 1.8.1 2.9 2.2 1.9c-.4.7-.9 1.3-1.5 1.8l-2.7-.8-2.6 1.2 1 2.4c-1 .5-2.1.8-3.3.8s-2.3-.3-3.3-.8l1-2.4-2.6-1.2-2.7.9a7.86 7.86 0 01-1.5-1.8l2.2-1.9.1-2.9-2.3-1.8c.1-.7.3-1.3.6-1.9l2.7.9 2.6-1.2-1-2.4c1-.5 2.1-.8 3.3-.8z"
      />
      <path
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        className="text-zinc-800/40"
        d="M12 12v9M12 12l-7-4M12 12l7-4M12 12l7 4M12 12l-7 4"
      />
    </svg>
  );
}
