import React from 'react';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ className, children, ...rest }) => {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
};

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle: React.FC<CardTitleProps> = ({ className, children, ...rest }) => {
  return (
    <h2 className={cn('card-title card-header', className)} {...rest}>
      {children}
    </h2>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...rest }) => {
  return (
    <div className={cn('card-header', className)} {...rest}>
      {children}
    </div>
  );
};

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => {
  return (
    <div className={cn('card-body', className)} {...rest}>
      {children}
    </div>
  );
};


