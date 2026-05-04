import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Kompakte Terminliste — eine Zeile, kein absolute, Inhalte dürfen die Karte in der Höhe wachsen lassen. */
export function CompactEventCard({ children, className = '' }: Props) {
  return (
    <div
      className={[
        'mb-3 flex min-h-[112px] w-full min-w-0 flex-row items-center rounded-2xl border border-white/[0.12] bg-zinc-950/50 p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
