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

/** Kompaktliste Training: klarer Fußball (ohne Kegel/Hantel-Motiv). */
export function CompactFootballBallIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" className="text-white/[0.92]" />
      <path
        fill="currentColor"
        className="text-zinc-900/45"
        d="M12 3.8c.35 0 .68.05 1 .14l-.35 2.05 1.75 1.02 1.9-.68c.52.45.98.97 1.35 1.55l-1.35 1.55v2.14l1.35 1.55c-.37.58-.83 1.1-1.35 1.55l-1.9-.68-1.75 1.02.35 2.05c-.32.09-.65.14-1 .14s-.68-.05-1-.14l.35-2.05-1.75-1.02-1.9.68a7.95 7.95 0 01-1.35-1.55l1.35-1.55v-2.14L7.75 8.4a7.95 7.95 0 011.35-1.55l1.9.68 1.75-1.02L12.35 3.9c-.32-.09-.65-.14-1-.14z"
      />
      <path
        stroke="currentColor"
        strokeWidth="0.85"
        strokeLinecap="round"
        className="text-zinc-900/35"
        d="M12 12v8.2M12 12L6.2 8.65M12 12l5.8-3.35M12 12l5.8 3.35M12 12L6.2 15.35"
      />
    </svg>
  );
}
