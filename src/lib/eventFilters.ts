/** Zentrale Event-Filter für Trainings- und Spielstatistik. */

export type EventLike = {
  kind?: string | null;
  type?: string | null;
  status?: string | null;
  starts_at?: string | null;
  match_id?: string | null;
};

const INACTIVE_STATUSES = new Set(['canceled', 'cancelled', 'deleted', 'archived']);

export function normalizeEventStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase();
}

export function isInactiveEventStatus(status: string | null | undefined): boolean {
  return INACTIVE_STATUSES.has(normalizeEventStatus(status));
}

/** Event ist nicht abgesagt/gelöscht/archiviert. */
export function isActiveEvent(event: EventLike): boolean {
  return !isInactiveEventStatus(event.status);
}

export function isTrainingKind(event: EventLike): boolean {
  const kind = (event.kind ?? event.type ?? '').trim().toLowerCase();
  return kind === 'training';
}

export function isMatchKind(event: EventLike): boolean {
  const kind = (event.kind ?? '').trim().toLowerCase();
  const type = (event.type ?? '').trim().toLowerCase();
  return kind === 'match' || type === 'match' || type === 'game';
}

/** Vergangenes, gültiges Team-Training. */
export function isPastTrainingEvent(event: EventLike, nowMs: number = Date.now()): boolean {
  if (!isTrainingKind(event)) return false;
  if (!isActiveEvent(event)) return false;
  const starts = event.starts_at ? Date.parse(event.starts_at) : NaN;
  return Number.isFinite(starts) && starts < nowMs;
}

/** Zukünftiges, gültiges Team-Training. */
export function isUpcomingTrainingEvent(event: EventLike, nowMs: number = Date.now()): boolean {
  if (!isTrainingKind(event)) return false;
  if (!isActiveEvent(event)) return false;
  const starts = event.starts_at ? Date.parse(event.starts_at) : NaN;
  return Number.isFinite(starts) && starts >= nowMs;
}

export function isFinishedGameStatus(status: string | null | undefined): boolean {
  return normalizeEventStatus(status) === 'finished';
}

/** Abgeschlossenes, gültiges Spiel-Event mit Match-Verknüpfung. */
export function isFinishedGameEvent(event: EventLike): boolean {
  if (!isMatchKind(event)) return false;
  if (!isActiveEvent(event)) return false;
  return isFinishedGameStatus(event.status);
}
