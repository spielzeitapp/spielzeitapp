import React from 'react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';

type AppButtonVariant = 'primary' | 'success' | 'secondary' | 'danger' | 'pending';
type AppButtonSize = 'sm' | 'md' | 'lg';

type AppButtonProps = {
  variant: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

const baseClass =
  'inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

const variantClass: Record<AppButtonVariant, string> = {
  primary: dsPrimaryCtaClass(),
  success:
    'rounded-[22px] border border-transparent bg-[rgba(20,110,70,0.30)] text-[#8DFFB7] font-semibold text-[1rem] tracking-[0.01em] shadow-[0_0_18px_rgba(40,255,120,0.10)]',
  secondary: dsSecondaryCtaClass(),
  danger:
    'bg-[rgba(120,18,28,0.32)] text-[#FF8D98] shadow-[0_0_14px_rgba(255,40,40,0.1)]',
  pending: 'bg-[rgba(18,18,22,0.88)] text-[#8E8E93] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
};

const sizeClass: Record<AppButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function AppButton({
  variant,
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: AppButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={[baseClass, variantClass[variant], sizeClass[size], fullWidth ? 'w-full' : '', className].join(' ')}
    >
      {children}
    </button>
  );
}
