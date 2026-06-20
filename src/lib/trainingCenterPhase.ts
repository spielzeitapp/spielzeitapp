import { isSameViennaCalendarDay } from './viennaTime';

export type TrainingCenterPhase = 'before' | 'during' | 'after';

export function resolveTrainingCenterPhase(params: {
  startsAtIso: string;
  status?: string | null;
  now?: Date;
}): TrainingCenterPhase {
  const status = String(params.status ?? '').trim().toLowerCase();
  if (status === 'finished' || status === 'completed' || status === 'canceled' || status === 'cancelled') {
    return 'after';
  }

  const now = params.now ?? new Date();
  const start = new Date(params.startsAtIso);
  if (Number.isNaN(start.getTime())) return 'before';

  if (status === 'live' || status === 'running') return 'during';

  if (isSameViennaCalendarDay(now, start)) {
    const msToStart = start.getTime() - now.getTime();
    if (msToStart <= 0) return 'during';
    if (msToStart <= 2 * 3_600_000) return 'during';
    return 'before';
  }

  if (now.getTime() > start.getTime()) return 'after';
  return 'before';
}
