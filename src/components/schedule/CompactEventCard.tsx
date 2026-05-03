import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Kompakte Terminliste — Wrapper ohne absolute Position, kein Clipping der Inhalte. */
export function CompactEventCard({ children, className = '' }: Props) {
  return (
    <div
      className={[
        'mb-3 w-full min-w-0 rounded-2xl border border-white/[0.12] bg-zinc-950/50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
