import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Status-Pill oder Trainer-Zahlen rechts oben (nur Darstellung). */
  topRight?: React.ReactNode;
};

/** Kompakte Liste: weniger vertikaler Abstand, dezente Kante. */
export function CompactEventCard({ children, className = '', topRight }: Props) {
  return (
    <div
      className={[
        'relative mb-3 w-full border-l-2 border-red-500/25 pl-2 sm:mb-4 sm:border-l-[3px] sm:pl-3',
        className,
      ].join(' ')}
    >
      {topRight ? (
        <div className="pointer-events-none absolute right-0 top-0 z-[4] max-w-[min(100%,11rem)] sm:right-0.5">
          {topRight}
        </div>
      ) : null}
      <div className={topRight ? 'pr-[5.5rem] sm:pr-[6rem]' : undefined}>{children}</div>
    </div>
  );
}
