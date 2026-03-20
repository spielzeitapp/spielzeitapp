import { isViennaCutoffPassed } from './viennaTime';

/**
 * @param deadlineDisabled – aus events.training_absence_deadline_disabled: true = keine 12:00-Frist
 */
export function isTrainingAbsenceDeadlinePassed(
  startsAtIso: string,
  deadlineDisabled: boolean | null | undefined,
  now: Date = new Date(),
): boolean {
  if (deadlineDisabled === true) return false;
  return isViennaCutoffPassed(startsAtIso, now, 12, 0);
}
