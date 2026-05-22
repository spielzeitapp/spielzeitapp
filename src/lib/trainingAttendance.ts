/** Training-Teilnahme (UI); Match/Event nutzt weiterhin yes/no. */

export type TrainingAttendanceStatus = 'open' | 'present' | 'absent' | 'injured';

export type TrainingAttendanceDbStatus = 'yes' | 'no' | 'injured';

export type TrainingAttendanceStats = {
  ratePct: number;
  present: number;
  absent: number;
  injured: number;
  open: number;
  /** Abgeschlossene Trainingseinheiten (starts_at in der Vergangenheit) */
  sessionsCounted: number;
};

const TRAINING_STATUS_LABEL: Record<TrainingAttendanceStatus, string> = {
  open: 'Offen',
  present: 'Dabei',
  absent: 'Abwesend',
  injured: 'Verletzt',
};

export function trainingAttendanceLabel(status: TrainingAttendanceStatus): string {
  return TRAINING_STATUS_LABEL[status];
}

/** DB-Zeile → UI-Status. Fehlende Zeile = open. */
export function dbStatusToTrainingAttendance(
  raw: string | null | undefined,
): TrainingAttendanceStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'yes') return 'present';
  if (s === 'no') return 'absent';
  if (s === 'injured') return 'injured';
  return 'open';
}

export function trainingAttendanceToDb(status: TrainingAttendanceStatus): TrainingAttendanceDbStatus | null {
  if (status === 'open') return null;
  if (status === 'present') return 'yes';
  if (status === 'absent') return 'no';
  return 'injured';
}

export function trainingAttendanceBucketRank(status: TrainingAttendanceStatus): number {
  if (status === 'open') return 0;
  if (status === 'present') return 1;
  if (status === 'injured') return 2;
  return 3;
}

/**
 * attendanceRate = present / (present + absent)
 * injured und open fließen nicht in den Nenner ein.
 */
export function computeTrainingAttendanceStats(
  sessionStatuses: TrainingAttendanceStatus[],
): TrainingAttendanceStats {
  let present = 0;
  let absent = 0;
  let injured = 0;
  let open = 0;
  for (const st of sessionStatuses) {
    if (st === 'present') present += 1;
    else if (st === 'absent') absent += 1;
    else if (st === 'injured') injured += 1;
    else open += 1;
  }
  const denom = present + absent;
  const ratePct = denom > 0 ? Math.round((present / denom) * 100) : 0;
  return {
    ratePct,
    present,
    absent,
    injured,
    open,
    sessionsCounted: sessionStatuses.length,
  };
}

export function countTrainingAttendanceByStatus(
  statuses: TrainingAttendanceStatus[],
): Pick<TrainingAttendanceStats, 'present' | 'absent' | 'injured' | 'open'> {
  return computeTrainingAttendanceStats(statuses);
}
