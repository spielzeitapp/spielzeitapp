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
        'relative min-h-[5.5rem] overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(220,38,38,0.12),0_10px_32px_rgba(0,0,0,0.45)] transition-[box-shadow,transform] active:scale-[0.99]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.14)_0%,transparent_55%)]"
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
            compactValue ? 'break-words text-[15px]' : 'text-[22px] tabular-nums leading-none tracking-tight',
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
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/45">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}
