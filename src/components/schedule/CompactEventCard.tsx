import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Kompakte „Weitere Termine“-Karte: kein absolute, kein negatives Margin am Wrapper. */
export function CompactEventCard({ children, className = '' }: Props) {
  return (
    <div
      className={[
        'mb-3 w-full min-w-0 rounded-2xl border border-red-950/45 bg-zinc-950 p-3.5 shadow-sm shadow-black/20',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
