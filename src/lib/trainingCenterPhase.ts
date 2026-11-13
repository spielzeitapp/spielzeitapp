import { isSameViennaCalendarDay } from './viennaTime';

export type TrainingCenterPhase = 'before' | 'during' | 'after';

export function resolveTrainingCenterPhase(params: {
  startsAtIso: string;
  status?: string | null;
  endsAtIso?: string | null;
  now?: Date;
}): TrainingCenterPhase {
  const status = String(params.status ?? '').trim().toLowerCase();
  if (status === 'finished' || status === 'completed' || status === 'canceled' || status === 'cancelled') {
    return 'after';
  }

  const now = params.now ?? new Date();
  const start = new Date(params.startsAtIso);
  if (Number.isNaN(start.getTime())) return 'before';

  const explicitEnd = params.endsAtIso ? new Date(params.endsAtIso).getTime() : NaN;
  const end = Number.isFinite(explicitEnd) && explicitEnd > start.getTime() ? explicitEnd : start.getTime() + 90 * 60_000;
  if (now.getTime() >= end + 10 * 60_000) return 'after';

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
