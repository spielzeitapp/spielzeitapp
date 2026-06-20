import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function TournamentCenterHeader() {
  return (
    <header className="relative flex min-h-[40px] items-center justify-between gap-2">
      <Link
        to="/app/termine"
        className="inline-flex min-h-[40px] min-w-[40px] items-center gap-0.5 rounded-full pr-2 text-[13px] font-medium text-white/85 touch-manipulation hover:text-white"
        aria-label="Zurück zum Spielplan"
      >
        <ChevronLeft className="h-5 w-5 shrink-0 text-red-400/90" strokeWidth={2.25} aria-hidden />
        <span className="sr-only sm:not-sr-only">Zurück</span>
      </Link>

      <h1 className="pointer-events-none absolute left-1/2 top-1/2 max-w-[min(52vw,12rem)] -translate-x-1/2 -translate-y-1/2 truncate text-center text-[16px] font-bold leading-none tracking-tight text-white">
        Turniercenter
      </h1>

      <div className="min-w-[40px]" aria-hidden />
    </header>
  );
}
