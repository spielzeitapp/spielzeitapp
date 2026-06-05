import React from 'react';
import { parseClubDisplayName } from '../../lib/feedClubNaming';

type Variant = 'poster' | 'posterArtwork' | 'result' | 'compact';

const variantClass: Record<
  Variant,
  { wrap: string; line1: string; line2: string }
> = {
  poster: {
    wrap: 'gap-0',
    line1:
      'block w-full min-w-0 break-words text-[12px] font-bold uppercase leading-[1.15] tracking-[0.02em] text-white/95 sm:text-[13px]',
    line2:
      'block w-full min-w-0 break-words text-[11px] font-semibold leading-[1.2] text-white/88 sm:text-[12px]',
  },
  posterArtwork: {
    wrap: 'gap-0',
    line1:
      'block w-full min-w-0 break-words text-[14px] font-extrabold uppercase leading-[1.12] tracking-[0.015em] text-white sm:text-[16px]',
    line2:
      'block w-full min-w-0 break-words text-[13px] font-bold leading-[1.18] text-white/92 sm:text-[14px]',
  },
  result: {
    wrap: 'gap-0',
    line1:
      'block w-full min-w-0 break-words text-[10px] font-bold uppercase leading-[1.12] tracking-[0.03em] text-white/92 sm:text-[11px]',
    line2:
      'block w-full min-w-0 break-words text-[10px] font-semibold leading-[1.15] text-white/85 sm:text-[11px]',
  },
  compact: {
    wrap: 'gap-0',
    line1:
      'block w-full min-w-0 break-words text-[11px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-white',
    line2:
      'block w-full min-w-0 break-words text-[10px] font-semibold leading-[1.15] text-white/88',
  },
};

type Props = {
  fullName: string;
  variant?: Variant;
  align?: 'center' | 'start';
  className?: string;
};

/** Zweizeiliger Vereinsname ohne Altersklasse im Namensblock. */
export const FeedClubName: React.FC<Props> = ({
  fullName,
  variant = 'poster',
  align = 'center',
  className = '',
}) => {
  const { line1, line2 } = parseClubDisplayName(fullName);
  const v = variantClass[variant];
  const alignClass = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  if (!line1 && !line2) return null;

  return (
    <div className={`flex min-w-0 flex-col ${v.wrap} ${alignClass} ${className}`.trim()}>
      <span className={v.line1}>{line1 || 'Team'}</span>
      {line2 ? <span className={v.line2}>{line2}</span> : null}
    </div>
  );
};
