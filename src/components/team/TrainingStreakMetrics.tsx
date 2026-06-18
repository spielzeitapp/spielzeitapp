import React from 'react';
import type { TrainingStreakSnapshot } from '../../lib/trainingChallengeTypes';
import { EMPTY_TRAINING_STREAK } from '../../lib/trainingChallengeTypes';
import { cn } from '../../ui/lib/cn';

const TILE_CLASS =
  'rounded-xl border border-[rgba(220,38,38,0.14)] bg-[rgba(8,8,10,0.72)] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

type Props = {
  streak?: TrainingStreakSnapshot | null;
  compact?: boolean;
  className?: string;
};

function formatStreakValue(count: number | null, unit: string): string {
  if (count == null) return 'Demnächst';
  if (count <= 0) return '—';
  return `${count} ${unit}`;
}

export const TrainingStreakMetrics: React.FC<Props> = ({
  streak = EMPTY_TRAINING_STREAK,
  compact = false,
  className,
}) => {
  const current = streak?.currentStreak ?? null;
  const best = streak?.seasonBestStreak ?? null;
  const unit = current === 1 || best === 1 ? 'Training' : 'Trainings';

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <div className={TILE_CLASS}>
        <p className="whitespace-nowrap text-[10px] font-medium text-white/35">Aktuelle Serie</p>
        <p
          className={cn(
            'mt-1 font-bold tabular-nums leading-none text-white',
            compact ? 'text-[16px]' : 'text-[18px]',
          )}
        >
          {formatStreakValue(current, unit)}
        </p>
      </div>
      <div className={TILE_CLASS}>
        <p className="whitespace-nowrap text-[10px] font-medium text-white/35">Saisonbestwert Serie</p>
        <p
          className={cn(
            'mt-1 font-bold tabular-nums leading-none text-white',
            compact ? 'text-[16px]' : 'text-[18px]',
          )}
        >
          {formatStreakValue(best, unit)}
        </p>
      </div>
    </div>
  );
};
