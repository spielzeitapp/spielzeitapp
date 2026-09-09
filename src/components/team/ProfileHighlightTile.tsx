import React from 'react';
import { cn } from '../../ui/lib/cn';

/** Premium-Kachel mit Wert + Subline — Trainerprofil, Team-Training. */
export function ProfileHighlightTile({
  icon,
  title,
  value,
  valueLine2,
  sub,
  compactValue = false,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  valueLine2?: string;
  sub?: string;
  compactValue?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative min-h-[5.5rem] overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--quiet px-3 py-3.5 transition-[box-shadow,transform] active:scale-[0.99]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 sz-club-card-glow"
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-1 -top-1" aria-hidden>
        {icon}
      </div>
      <div className="relative pr-14 text-left">
        <div className="whitespace-nowrap text-[11px] font-medium leading-tight tracking-wide text-white/55">
          {title}
        </div>
        <div
          className={cn(
            'mt-1.5 font-bold leading-snug text-white',
            compactValue ? 'whitespace-nowrap text-[13px]' : 'text-[22px] tabular-nums leading-none tracking-tight',
          )}
        >
          {value}
        </div>
        {valueLine2 ? (
          <p className="mt-0.5 break-words text-[13px] font-semibold leading-snug text-white/90">
            {valueLine2}
          </p>
        ) : null}
        {sub ? (
          <p className="mt-1 text-[9px] leading-snug text-white/45 [hyphens:none]">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}
