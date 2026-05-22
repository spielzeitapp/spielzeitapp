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
    'bg-gradient-to-r from-[#ef3b43] via-[#e02129] to-[#c41a22] text-white border border-[#ff5a5f]/18 shadow-[0_6px_20px_rgba(224,33,41,0.28)]',
  success:
    'bg-gradient-to-b from-emerald-600/95 to-emerald-800/90 text-white border border-emerald-500/20 shadow-[0_4px_16px_rgba(25,195,125,0.18)]',
  secondary:
    'bg-gradient-to-b from-[#1e1e24] to-[#121214] text-white/88 border border-[#2a2a2e]/70 shadow-[0_2px_10px_rgba(0,0,0,0.3)]',
  danger:
    'bg-gradient-to-b from-[#d42830]/95 to-[#8f1418]/95 text-white border border-red-500/18 shadow-[0_4px_16px_rgba(224,33,41,0.22)]',
  pending: 'bg-[#1a1a1f] text-white/75 border border-[#2a2a2e] shadow-none',
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
