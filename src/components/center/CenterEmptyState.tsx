import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { dsPrimaryCtaClass, dsScheduleGlassButtonClass } from '../../lib/premiumDesignSystem';
import { EC_CARD, EC_CARD_INNER } from './eventCenterStyles';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'glass';
  className?: string;
  embedded?: boolean;
};

export function CenterEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'glass',
  className = '',
  embedded = false,
}: Props) {
  const ctaClass = actionVariant === 'primary' ? dsPrimaryCtaClass() : dsScheduleGlassButtonClass();

  const body = (
    <div className={`flex min-h-[7.5rem] max-h-[8.75rem] flex-col items-center justify-center gap-1.5 py-3 text-center ${embedded ? '' : EC_CARD_INNER}`}>
      <Icon className="h-5 w-5 text-white/28" strokeWidth={1.75} aria-hidden />
      <p className="text-[13px] font-semibold leading-snug text-white/82">{title}</p>
      <p className="max-w-[16rem] text-[11px] leading-snug text-white/45">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={`mt-0.5 inline-flex min-h-[32px] items-center justify-center rounded-full px-3 text-[11px] font-semibold touch-manipulation ${ctaClass}`}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );

  if (embedded) {
    return <div className={className}>{body}</div>;
  }

  return (
    <section className={`${EC_CARD} ${className}`}>
      {body}
    </section>
  );
}
