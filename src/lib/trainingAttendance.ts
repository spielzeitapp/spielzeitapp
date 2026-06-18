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
  if (s === 'maybe') return 'legacy_unknown';
  return 'legacy_unknown';
}

function isPastTrainingStart(
  eventStartsAtIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (!eventStartsAtIso) return true;
  const t = Date.parse(eventStartsAtIso);
  if (!Number.isFinite(t)) return true;
  return t < nowMs;
}

/**
 * Live-/Termin-UI: fehlende event_attendance-Zeile = Dabei (bestehendes Verhalten).
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

/**
 * Statistik/Auswertung: fehlende Zeile bei vergangenem Training = legacy_unknown (nicht im Nenner).
 * Zukünftiges/aktuelles Training ohne Zeile = open.
 */
export function resolveTrainingAttendanceStatusForStats(
  rawDbStatus: string | null | undefined,
  eventStartsAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): TrainingAttendanceStatus {
  const mapped = dbStatusToTrainingAttendance(rawDbStatus);
  if (mapped) return mapped;
  if (isPastTrainingStart(eventStartsAtIso, nowMs)) return 'legacy_unknown';
  return 'open';
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
 * Krank, Verletzt, LAZ, open, legacy_unknown nicht im Nenner der Team-Quote.
 */
export function computeTrainingAttendanceStats(
  sessionStatuses: TrainingAttendanceStatus[],
): TrainingAttendanceStats {
  let present = 0;
  let absent = 0;
  let sick = 0;
  let injured = 0;
  let external = 0;
  let open = 0;
  let legacyUnknown = 0;

  for (const st of sessionStatuses) {
    if (st === 'present') present += 1;
    else if (st === 'absent') absent += 1;
    else if (st === 'sick') sick += 1;
    else if (st === 'injured') injured += 1;
    else if (st === 'external') external += 1;
    else if (st === 'legacy_unknown') legacyUnknown += 1;
    else open += 1;
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
    open,
    legacyUnknown,
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
