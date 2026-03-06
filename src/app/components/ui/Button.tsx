import React from 'react';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'soft' | 'ghost' | 'secondary';
type Size = 'default' | 'sm' | 'xs';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  size?: Size;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  fullWidth,
  size,
  className,
  children,
  ...rest
}) => {
  const variantClass =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'soft' || variant === 'secondary'
        ? 'btn-soft'
        : variant === 'ghost'
          ? 'btn-ghost'
          : 'btn-primary';

  return (
    <button
      className={cn(
        'btn',
        variantClass,
        fullWidth && 'btn--full',
        size === 'sm' && 'btn--sm',
        size === 'xs' && 'btn--xs',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
};

