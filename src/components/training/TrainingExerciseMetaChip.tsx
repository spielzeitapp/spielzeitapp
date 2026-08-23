import React from 'react';

type Props = {
  children: React.ReactNode;
  tone?: 'default' | 'private' | 'phase';
};

export function TrainingExerciseMetaChip({ children, tone = 'default' }: Props): React.ReactElement {
  return (
    <span
      className={[
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
        tone === 'private'
          ? 'bg-amber-50 text-amber-800'
          : tone === 'phase'
            ? 'bg-red-50 text-red-800'
            : 'bg-slate-100 text-slate-600',
      ].join(' ')}
    >
      {children}
    </span>
  );
}
