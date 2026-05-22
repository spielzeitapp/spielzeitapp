import React from 'react';
import { dsStatusChipClass, type DsChipTone } from '../../lib/premiumDesignSystem';

export type PremiumStatusBadgeTone = DsChipTone | 'warning' | 'selected';

const TONE_MAP: Record<PremiumStatusBadgeTone, DsChipTone> = {
  present: 'present',
  absent: 'absent',
  injured: 'injured',
  external: 'external',
  open: 'open',
  neutral: 'neutral',
  selected: 'selected',
  warning: 'injured',
};

type Props = {
  label: string;
  tone?: PremiumStatusBadgeTone;
  className?: string;
};

export const PremiumStatusBadge: React.FC<Props> = ({ label, tone = 'neutral', className = '' }) => (
  <span className={[dsStatusChipClass(TONE_MAP[tone] ?? 'neutral'), className].join(' ')}>
    {label}
  </span>
);
