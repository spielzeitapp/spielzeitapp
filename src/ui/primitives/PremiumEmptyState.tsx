import React from 'react';
import { dsBodyTextClass, dsPageSubtitleClass } from '../../lib/premiumDesignSystem';
import { cn } from '../lib/cn';
import { GlassCard } from './GlassCard';

export type PremiumEmptyStateVariant = 'default' | 'interactive' | 'subtle';

export type PremiumEmptyStateProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  variant?: PremiumEmptyStateVariant;
  className?: string;
};

/**
 * Leerer Zustand — GlassCard + Typo aus premiumDesignSystem (keine Logik).
 */
export const PremiumEmptyState: React.FC<PremiumEmptyStateProps> = ({
  title,
  description,
  children,
  variant = 'default',
  className,
}) => {
  const cardVariant = variant === 'subtle' ? 'subtle' : 'default';

  return (
    <GlassCard variant={cardVariant} className={cn('px-4 py-8 text-center', className)}>
      <p className="text-base font-semibold leading-snug text-white">{title}</p>
      {description ? (
        <p className={cn(dsPageSubtitleClass(), 'mt-2 text-center')}>{description}</p>
      ) : null}
      {children ? <div className={cn(dsBodyTextClass(), 'mt-4')}>{children}</div> : null}
    </GlassCard>
  );
};
