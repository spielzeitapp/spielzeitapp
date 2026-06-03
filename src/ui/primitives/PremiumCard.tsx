import React from 'react';
import { dsCardAmbientGlowClass, dsCardShellClass } from '../../lib/premiumDesignSystem';
import { cn } from '../lib/cn';

export type PremiumCardVariant = 'default' | 'interactive' | 'subtle';

export type PremiumCardProps = {
  children: React.ReactNode;
  variant?: PremiumCardVariant;
  /** Matchday-Surface + stärkerer Ambient-Glow */
  matchday?: boolean;
  /** Radial-Glow-Overlay (Standard bei default/interactive) */
  showAmbientGlow?: boolean;
  className?: string;
  as?: 'div' | 'article' | 'section';
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>;

/**
 * Stadium-Card — Wrapper um dsCardShellClass + optional dsCardAmbientGlowClass.
 */
export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  variant = 'default',
  matchday = false,
  showAmbientGlow,
  className,
  as: Tag = 'div',
  ...rest
}) => {
  const interactive = variant === 'interactive';
  const subtle = variant === 'subtle';
  const glow = showAmbientGlow ?? !subtle;
  const useMatchday = matchday && !subtle;

  return (
    <Tag
      {...rest}
      className={cn(
        dsCardShellClass({
          interactive,
          matchday: useMatchday,
          className,
        }),
      )}
    >
      {glow ? (
        <div className={cn(dsCardAmbientGlowClass(useMatchday), 'z-0')} aria-hidden />
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </Tag>
  );
};
