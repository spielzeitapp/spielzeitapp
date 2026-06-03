import React from 'react';
import {
  dsMatchdaySectionLabelClass,
  dsMetaTextClass,
  dsPageSubtitleClass,
  dsPageTitleClass,
  dsSectionLabelClass,
} from '../../lib/premiumDesignSystem';
import { cn } from '../lib/cn';

export type SectionTitleVariant = 'default' | 'interactive' | 'subtle';

export type SectionTitleProps = {
  children: React.ReactNode;
  /** Screen-H1 */
  variant?: SectionTitleVariant;
  /** Optionaler Untertitel */
  subtitle?: React.ReactNode;
  subtitleClassName?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, 'className' | 'children'>;

function titleClass(variant: SectionTitleVariant): string {
  if (variant === 'subtle') return dsMetaTextClass();
  if (variant === 'interactive') return dsMatchdaySectionLabelClass();
  return dsPageTitleClass();
}

/**
 * Seiten- oder Abschnittstitel — Wrapper um dsPageTitle / dsSectionLabel / dsMetaText.
 */
export const SectionTitle: React.FC<SectionTitleProps> = ({
  children,
  variant = 'default',
  subtitle,
  subtitleClassName,
  as: Tag = 'h1',
  className,
  ...rest
}) => {
  const sub =
    subtitle != null ? (
      <p className={cn(variant === 'default' ? dsPageSubtitleClass() : dsSectionLabelClass(), subtitleClassName)}>
        {subtitle}
      </p>
    ) : null;

  return (
    <div className={cn('min-w-0', className)}>
      <Tag {...rest} className={cn(titleClass(variant), 'min-w-0')}>
        {children}
      </Tag>
      {sub}
    </div>
  );
};
