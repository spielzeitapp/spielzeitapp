import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Kompakte Liste: linke Akzentkante, Inhalt von ScheduleCompactEventRow. */
export function CompactEventCard({ children, className = '' }: Props) {
  return (
    <div
      className={[
        'mb-2.5 w-full border-l-2 border-red-500/30 pl-2 sm:mb-3 sm:border-l-[3px] sm:pl-2.5',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
