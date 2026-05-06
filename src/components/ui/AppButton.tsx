import React from 'react';

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
  'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

const variantClass: Record<AppButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-red-700 via-red-600 to-red-500 text-white border border-red-300/20 shadow-[0_0_18px_rgba(239,68,68,0.28)]',
  success:
    'bg-green-600/90 text-white border border-green-300/20 shadow-[0_0_14px_rgba(34,197,94,0.24)]',
  secondary: 'bg-white/7 text-white/85 border border-white/15 shadow-none',
  danger:
    'bg-red-700/90 text-white border border-red-300/20 shadow-[0_0_14px_rgba(239,68,68,0.22)]',
  pending: 'bg-slate-700/75 text-white/90 border border-white/10 shadow-none',
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
