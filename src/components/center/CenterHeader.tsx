import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

type Props = {
  title: string;
  backLabel?: string;
};

export function CenterHeader({ title, backLabel = 'Zurück zum Spielplan' }: Props) {
  return (
    <header className="relative h-[48px]" aria-label={title}>
      <div className="fixed inset-x-0 top-[var(--app-header-offset)] z-40 border-b border-white/[0.06] bg-[rgba(6,6,8,0.92)] shadow-[0_8px_20px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <div className="relative mx-auto flex min-h-[48px] w-full max-w-2xl items-center justify-between gap-2 px-3 sm:px-4">
          <Link
            to="/app/termine"
            className="inline-flex min-h-[38px] items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 pr-3 text-[14px] font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] touch-manipulation hover:bg-white/[0.07] hover:text-white"
            aria-label={backLabel}
          >
            <ChevronLeft className="h-5 w-5 shrink-0 text-red-400" strokeWidth={2.5} aria-hidden />
            <span>Zurück</span>
          </Link>
          <h1 className="pointer-events-none absolute left-1/2 top-1/2 max-w-[min(46vw,14rem)] -translate-x-1/2 -translate-y-1/2 truncate text-center text-[16px] font-bold leading-none tracking-tight text-white">
            {title}
          </h1>
          <div className="min-w-[76px]" aria-hidden />
        </div>
      </div>
    </header>
  );
}
