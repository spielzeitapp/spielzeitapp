import React from 'react';
import { AppButton } from '../../../components/ui/AppButton';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'soft' | 'ghost' | 'secondary' | 'positive' | 'negative' | 'pending';
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
  const appVariant =
    variant === 'primary'
      ? 'primary'
      : variant === 'positive'
        ? 'success'
        : variant === 'negative'
          ? 'danger'
          : variant === 'pending'
            ? 'pending'
            : 'secondary';

  const appSize = size === 'sm' ? 'sm' : size === 'xs' ? 'sm' : 'md';

  return (
    <AppButton variant={appVariant} size={appSize} fullWidth={Boolean(fullWidth)} className={cn(className)} {...rest}>
      {children}
    </AppButton>
  );
};

