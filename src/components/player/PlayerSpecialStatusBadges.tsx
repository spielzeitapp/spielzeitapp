import React from 'react';
import { cn } from '../../ui/lib/cn';

type Props = {
  isLaz?: boolean;
  isInjured?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
};

const SIZE_CLASS = {
  xs: 'px-1.5 py-0.5 text-[8px] tracking-[0.1em]',
  sm: 'px-2 py-0.5 text-[9px] tracking-[0.12em]',
} as const;

export function PlayerSpecialStatusBadges({
  isLaz = false,
  isInjured = false,
  size = 'sm',
  className,
}: Props) {
  if (!isLaz && !isInjured) return null;

  const base = `inline-flex items-center rounded-full border font-bold uppercase whitespace-nowrap ${SIZE_CLASS[size]}`;

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {isLaz ? (
        <span
          className={`${base} border-violet-500/35 bg-violet-950/50 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.12)]`}
        >
          LAZ
        </span>
      ) : null}
      {isInjured ? (
        <span
          className={`${base} border-amber-500/35 bg-amber-950/50 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)]`}
        >
          Verletzt
        </span>
      ) : null}
    </span>
  );
}
