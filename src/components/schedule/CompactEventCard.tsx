import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Kompakte Terminliste — Premium-Karte mit klarem Rand (Zielbild). */
export function CompactEventCard({ children, className = '' }: Props) {
  return (
    <div
      className={[
        'mb-2 w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.1] bg-zinc-950/55 shadow-[0_2px_20px_rgba(0,0,0,0.35)] sm:mb-2.5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
