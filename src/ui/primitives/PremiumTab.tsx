import React from 'react';
import {
  dsFormationTabClass,
  dsScheduleFilterTabClass,
  dsSegmentTabClass,
  dsSegmentTrackClass,
} from '../../lib/premiumDesignSystem';
import { cn } from '../lib/cn';

export type PremiumTabVariant = 'default' | 'interactive' | 'subtle';
export type PremiumTabKind = 'segment' | 'filter' | 'formation';

export type PremiumTabProps = {
  children: React.ReactNode;
  active?: boolean;
  kind?: PremiumTabKind;
  variant?: PremiumTabVariant;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

function tabClass(kind: PremiumTabKind, active: boolean, variant: PremiumTabVariant): string {
  if (variant === 'subtle' && !active) {
    return cn(
      'min-h-[36px] flex-1 rounded-[14px] border border-transparent px-2.5 text-[12px] font-semibold text-white/45 transition-colors duration-150',
      'hover:bg-[rgba(14,14,18,0.75)] hover:text-white/62',
    );
  }
  if (kind === 'filter') return dsScheduleFilterTabClass(active);
  if (kind === 'formation') return dsFormationTabClass(active);
  return dsSegmentTabClass(active);
}

/**
 * Einzelner Tab-Button — Wrapper um dsSegmentTab / dsScheduleFilterTab / dsFormationTab.
 */
export const PremiumTab: React.FC<PremiumTabProps> = ({
  children,
  active = false,
  kind = 'segment',
  variant = 'default',
  className,
  type = 'button',
  ...rest
}) => {
  return (
    <button type={type} {...rest} className={cn(tabClass(kind, active, variant), className)}>
      {children}
    </button>
  );
};

export type PremiumTabTrackProps = {
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;

/** Segment-Track (z. B. Termine-Filter-Zeile). */
export const PremiumTabTrack: React.FC<PremiumTabTrackProps> = ({ children, className, ...rest }) => {
  return (
    <div {...rest} className={cn(dsSegmentTrackClass(), className)} role="tablist">
      {children}
    </div>
  );
};
