import React from 'react';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

type PillVariant = 'live' | 'upcoming' | 'finished' | 'not-started';

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
}

export const Pill: React.FC<PillProps> = ({ variant, className, children, ...rest }) => {
  const variantClass =
    variant === 'live'
      ? 'pill-live'
      : variant === 'upcoming'
        ? 'pill-upcoming'
        : variant === 'finished'
          ? 'pill-finished'
          : variant === 'not-started'
            ? 'pill-not-started'
            : '';

  return (
    <span className={cn('pill', variantClass, className)} {...rest}>
      {children}
    </span>
  );
};
