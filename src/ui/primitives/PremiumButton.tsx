import React from 'react';
import {
  dsPrimaryCtaClass,
  dsSecondaryCtaClass,
  dsTertiaryButtonClass,
} from '../../lib/premiumDesignSystem';
import { cn } from '../lib/cn';

export type PremiumButtonVariant = 'default' | 'interactive' | 'subtle';

export type PremiumButtonProps = {
  children: React.ReactNode;
  /** default → primary CTA; interactive → secondary; subtle → tertiary */
  variant?: PremiumButtonVariant;
  fullWidth?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

const BASE =
  'inline-flex min-h-[44px] touch-manipulation items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

function variantClass(variant: PremiumButtonVariant): string {
  if (variant === 'subtle') return dsTertiaryButtonClass();
  if (variant === 'interactive') return dsSecondaryCtaClass();
  return dsPrimaryCtaClass();
}

/**
 * Premium-CTA — Wrapper um dsPrimaryCta / dsSecondaryCta / dsTertiaryButton.
 */
export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  variant = 'default',
  fullWidth = false,
  className,
  type = 'button',
  ...rest
}) => {
  return (
    <button type={type} {...rest} className={cn(BASE, variantClass(variant), fullWidth && 'w-full', className)}>
      {children}
    </button>
  );
};
