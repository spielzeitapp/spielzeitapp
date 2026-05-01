import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Kompakte Liste: weniger vertikaler Abstand, dezente Kante. */
export function CompactEventCard({ children, className = '' }: Props) {
  return (
    <div
      className={[
        'mb-3 w-full border-l-2 border-red-500/25 pl-2 sm:mb-4 sm:border-l-[3px] sm:pl-3',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
