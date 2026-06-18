/** Training-Teilnahme (UI); Match/Event nutzt weiterhin yes/no. */

export type TrainingAttendanceStatus =
  | 'open'
  | 'present'
  | 'absent'
  | 'sick'
  | 'injured'
  | 'external'
  | 'legacy_unknown';

export type TrainingAttendanceDbStatus =
  | 'yes'
  | 'no'
  | 'sick'
  | 'injured'
  | 'external_training';

export type TrainingAttendanceStats = {
  /** Individuelle Team-Trainingsbeteiligung: yes / (yes + no) */
  teamRatePct: number;
  /** Individuelle Trainingsaktivität: (yes + external) / (yes + external + no) */
  activityRatePct: number;
  present: number;
  absent: number;
  sick: number;
  injured: number;
  external: number;
  open: number;
  legacyUnknown: number;
  sessionsCounted: number;
};

const TRAINING_STATUS_LABEL: Record<TrainingAttendanceStatus, string> = {
  open: 'Offen',
  present: 'Dabei',
  absent: 'Abwesend',
  sick: 'Krank',
  injured: 'Verletzt',
  external: 'LAZ',
  legacy_unknown: 'Nicht erfasst',
};

export function trainingAttendanceLabel(status: TrainingAttendanceStatus): string {
  return TRAINING_STATUS_LABEL[status];
}

/** DB-Zeile → UI-Status (nur wenn Zeile existiert). */
export function dbStatusToTrainingAttendance(
  raw: string | null | undefined,
): TrainingAttendanceStatus | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'yes') return 'present';
  if (s === 'no') return 'absent';
  if (s === 'sick') return 'sick';
  if (s === 'injured') return 'injured';
  if (s === 'external_training') return 'external';
  if (s === 'maybe') return 'present';
  return null;
}

/**
 * Live-/Termin-UI und Statistik: fehlende event_attendance-Zeile = Dabei.
 * Vergangene Trainings ohne Zeile zählen als teilgenommen; es gibt kein „offen“ oder „nicht erfasst“.
 */
export function resolveTrainingAttendanceStatus(
  rawDbStatus: string | null | undefined,
  _eventStartsAtIso: string | null | undefined,
  _nowMs: number = Date.now(),
): TrainingAttendanceStatus {
  const mapped = dbStatusToTrainingAttendance(rawDbStatus);
  if (mapped) return mapped;
  return 'present';
}

/** Statistik: identische Auflösung wie Live-UI (nur vergangene Trainings werden geladen). */
export function resolveTrainingAttendanceStatusForStats(
  rawDbStatus: string | null | undefined,
  eventStartsAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): TrainingAttendanceStatus {
  return resolveTrainingAttendanceStatus(rawDbStatus, eventStartsAtIso, nowMs);
}

export function trainingAttendanceToDb(status: TrainingAttendanceStatus): TrainingAttendanceDbStatus | null {
  if (status === 'open' || status === 'legacy_unknown') return null;
  if (status === 'present') return 'yes';
  if (status === 'absent') return 'no';
  if (status === 'sick') return 'sick';
  if (status === 'external') return 'external_training';
  return 'injured';
}

export function trainingAttendanceBucketRank(status: TrainingAttendanceStatus): number {
  if (status === 'open') return 0;
  if (status === 'legacy_unknown') return 1;
  if (status === 'present') return 2;
  if (status === 'external') return 3;
  if (status === 'sick') return 4;
  if (status === 'injured') return 5;
  return 6;
}

function pct(num: number, denom: number): number {
  return denom > 0 ? Math.round((num / denom) * 100) : 0;
}

/** Mannschafts-/Einzeltraining: Dabei / (Dabei + Abwesend). Krank, Verletzt, LAZ neutral. */
export function computeSessionParticipationPct(
  counts: Pick<TrainingAttendanceCounts, 'present' | 'absent'>,
): number | null {
  const denom = counts.present + counts.absent;
  if (denom <= 0) return null;
  return pct(counts.present, denom);
}

/** Farbliche Bewertung Mannschafts-Beteiligung (Trainingszentrale). */
export function participationPctColorClass(pct: number): string {
  if (pct >= 70) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  if (pct >= 30) return 'text-orange-400';
  return 'text-red-400';
}

export function participationPctBadgeClass(pct: number): string {
  if (pct >= 70) {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.12)]';
  }
  if (pct >= 50) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.1)]';
  }
  if (pct >= 30) {
    return 'border-orange-500/25 bg-orange-500/10 text-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.1)]';
  }
  return 'border-red-500/25 bg-red-500/10 text-red-400 shadow-[0_0_18px_rgba(248,113,113,0.1)]';
}

/**
 * Training-Übersicht (Trainer): Dabei = aktiv − (Abwesend + Krank + Verletzt + LAZ).
 */
export function countTrainingOverviewFromStatuses(
  statuses: TrainingAttendanceStatus[],
  activePlayerCount: number,
): { present: number; notPresent: number } {
  const c = countTrainingAttendanceByStatus(statuses);
  const notPresent = c.absent + c.sick + c.injured + c.external;
  return { present: Math.max(0, activePlayerCount - notPresent), notPresent };
}

/**
 * Profil-Auswertung (vergangene Einheiten, bereits aufgelöste Status).
 * Krank, Verletzt und LAZ nicht im Nenner der Team-Quote (neutral).
 */
export function computeTrainingAttendanceStats(
  sessionStatuses: TrainingAttendanceStatus[],
): TrainingAttendanceStats {
  let present = 0;
  let absent = 0;
  let sick = 0;
  let injured = 0;
  let external = 0;

  for (const st of sessionStatuses) {
    if (st === 'present' || st === 'open' || st === 'legacy_unknown') present += 1;
    else if (st === 'absent') absent += 1;
    else if (st === 'sick') sick += 1;
    else if (st === 'injured') injured += 1;
    else if (st === 'external') external += 1;
  }

  const teamDenom = present + absent;
  const activityDenom = present + external + absent;

  return {
    teamRatePct: pct(present, teamDenom),
    activityRatePct: pct(present + external, activityDenom),
    present,
    absent,
    sick,
    injured,
    external,
    open: 0,
    legacyUnknown: 0,
    sessionsCounted: sessionStatuses.length,
  };
}

export type TrainingAttendanceCounts = Pick<
  TrainingAttendanceStats,
  'present' | 'absent' | 'sick' | 'injured' | 'external' | 'open' | 'legacyUnknown'
>;

export function countTrainingAttendanceByStatus(statuses: TrainingAttendanceStatus[]): TrainingAttendanceCounts {
  const s = computeTrainingAttendanceStats(statuses);
  return {
    present: s.present,
    absent: s.absent,
    sick: s.sick,
    injured: s.injured,
    external: s.external,
    open: s.open,
    legacyUnknown: s.legacyUnknown,
  };
}

/**
 * Termine-Karten (Training): gleiche Zählregel wie TrainingAttendancePanel —
 * nur aktive Kader-Spieler, fehlende event_attendance-Zeile = Dabei.
 */
export function trainingScheduleCardCounts(params: {
  rosterPlayerIds: string[];
  availabilityByPlayerId?: Record<string, string | null | undefined>;
  startsAtIso?: string | null;
}): { yes: number; no: number; open: number } {
  const byPlayer = params.availabilityByPlayerId ?? {};
  const statuses = params.rosterPlayerIds.map((playerId) =>
    resolveTrainingAttendanceStatus(
      byPlayer[(playerId ?? '').toLowerCase()] ?? null,
      params.startsAtIso ?? null,
    ),
  );
  const c = countTrainingAttendanceByStatus(statuses);
  return {
    yes: c.present,
    no: c.absent + c.sick + c.injured + c.external,
    open: 0,
  };
}
