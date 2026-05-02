import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Kompakte Liste — nur feiner Rand, kein „Karten“-Block. */
export function CompactEventCard({ children, className = '' }: Props) {
  return <div className={['mb-1.5 w-full border-l border-red-500/25 pl-1.5 sm:mb-2 sm:pl-2', className].join(' ')}>{children}</div>;
}
