import React from 'react';
import {
  dsFeedCardGlowClass,
  dsFeedCardShellClass,
  dsScheduleListPanelClass,
  dsScheduleListPanelGlowClass,
} from '../../lib/premiumDesignSystem';
import { cn } from '../lib/cn';

export type GlassCardVariant = 'default' | 'interactive' | 'subtle';

export type GlassCardProps = {
  children: React.ReactNode;
  variant?: GlassCardVariant;
  showAmbientGlow?: boolean;
  className?: string;
  as?: 'div' | 'article' | 'section';
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>;

/**
 * Glas-/Feed-Card — Wrapper um dsFeedCardShell oder flache Schedule-Liste (subtle).
 */
export const GlassCard = React.forwardRef<HTMLElement, GlassCardProps>(function GlassCard(
  { children, variant = 'default', showAmbientGlow = true, className, as: Tag = 'div', ...rest },
  ref,
) {
  const subtle = variant === 'subtle';

  if (subtle) {
    return (
      <Tag {...rest} ref={ref as React.Ref<HTMLDivElement>} className={cn(dsScheduleListPanelClass(), 'relative', className)}>
        {showAmbientGlow ? (
          <div className={cn(dsScheduleListPanelGlowClass(), 'z-0')} aria-hidden />
        ) : null}
        <div className="relative z-[1]">{children}</div>
      </Tag>
    );
  }

  return (
    <Tag {...rest} ref={ref as React.Ref<HTMLDivElement>} className={cn(dsFeedCardShellClass(className), 'relative')}>
      {showAmbientGlow ? (
        <div className={cn(dsFeedCardGlowClass(), 'z-0')} aria-hidden />
      ) : null}
      <div className={cn('relative z-[1]', variant === 'interactive' && 'cursor-pointer')}>{children}</div>
    </Tag>
  );
});
