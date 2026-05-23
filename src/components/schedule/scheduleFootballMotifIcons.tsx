import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';
import { TrainingPlayerIcon } from './TrainingPlayerIcon';

/** @deprecated — Nutze TrainingPlayerIcon */
export function PitchNavIcon({ className = '' }: { className?: string }) {
  return <TrainingPlayerIcon variant="list" className={className} />;
}

export function TrainingMotifIcon({ className = '' }: { className?: string }) {
  return <TrainingPlayerIcon variant="list" className={className} />;
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

/** Kompaktliste Training. */
export function CompactFootballBallIcon({ className = '' }: { className?: string }) {
  return <TrainingPlayerIcon variant="list" className={className} />;
}
