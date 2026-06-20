import { isSameViennaCalendarDay } from './viennaTime';
import type { TournamentCompletionState } from './tournamentCompletion';
import type { TournamentMatchSlotView } from './tournamentPlan';

export type TournamentCenterPhase = 'before' | 'day' | 'after';

export function resolveTournamentCenterPhase(params: {
  tournamentDayIso: string;
  slots: TournamentMatchSlotView[];
  completion: TournamentCompletionState | null;
  now?: Date;
}): TournamentCenterPhase {
  const now = params.now ?? new Date();
  const tournamentStart = new Date(params.tournamentDayIso);

  if (params.completion?.completedAt) return 'after';

  const allFinished =
    params.slots.length > 0 &&
    params.slots.every((slot) => (slot.match_status ?? '').toLowerCase() === 'finished');
  if (allFinished) return 'after';

  const hasLive = params.slots.some((slot) => (slot.match_status ?? '').toLowerCase() === 'live');
  if (hasLive) return 'day';

  if (!Number.isNaN(tournamentStart.getTime()) && isSameViennaCalendarDay(now, tournamentStart)) {
    return 'day';
  }

  if (!Number.isNaN(tournamentStart.getTime()) && now.getTime() > tournamentStart.getTime() + 86_400_000) {
    const anyOpen = params.slots.some(
      (slot) => (slot.match_status ?? '').toLowerCase() !== 'finished',
    );
    if (!anyOpen && params.slots.length > 0) return 'after';
  }

  return 'before';
}
