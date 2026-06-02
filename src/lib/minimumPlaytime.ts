/** Standard-Mindestspielzeit pro Spiel (Minuten). */
export const DEFAULT_MINIMUM_PLAYTIME_MINUTES = 20;

/** Fallback geplante Spielzeit (Minuten), wenn keine Match-Dauer hinterlegt ist. */
export const DEFAULT_PLANNED_MATCH_MINUTES = 60;

export const PLANNED_MATCH_MINUTE_PRESETS = [30, 40, 50, 60, 75, 90] as const;
export const MINIMUM_PLAYTIME_MINUTE_PRESETS = [10, 15, 20, 25, 30] as const;

export type MinimumPlaytimeStatus = 'ok' | 'warning' | 'critical';

/** Dringlichkeit relativ zur verbleibenden effektiven Spielzeit. */
export type MinimumPlaytimeUrgency = 'ok' | 'warning' | 'urgent' | 'critical';

export function normalizePlannedMatchMinutes(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_PLANNED_MATCH_MINUTES;
  return Math.min(120, Math.max(15, n));
}

export function normalizeMinimumPlaytimeMinutes(
  value: unknown,
  plannedMinutes?: number | null,
): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_MINIMUM_PLAYTIME_MINUTES;
  let v = Math.min(90, Math.max(1, n));
  if (plannedMinutes != null && Number.isFinite(Number(plannedMinutes))) {
    v = Math.min(v, normalizePlannedMatchMinutes(plannedMinutes));
  }
  return v;
}

export function minimumPlaytimeExceedsPlanned(
  minimumMinutes: number,
  plannedMinutes: number,
): boolean {
  const min = Math.round(Number(minimumMinutes));
  const planned = normalizePlannedMatchMinutes(plannedMinutes);
  if (!Number.isFinite(min)) return false;
  return min > planned;
}

export function minimumPlaytimeSecondsFromMinutes(minutes: number): number {
  return normalizeMinimumPlaytimeMinutes(minutes) * 60;
}

export function getPlannedMatchDurationSeconds(options?: {
  plannedMinutes?: number | null | undefined;
}): number {
  return normalizePlannedMatchMinutes(options?.plannedMinutes) * 60;
}

/** Verbleibende effektive Spielzeit (ohne Pausen) bis geplantes Spielende. */
export function getRemainingEffectiveMatchSeconds(
  plannedDurationSeconds: number,
  currentEffectiveSeconds: number,
): number {
  const planned = Math.max(0, Math.floor(plannedDurationSeconds));
  const elapsed = Math.max(0, Math.floor(currentEffectiveSeconds));
  return Math.max(0, planned - elapsed);
}

export type MinimumPlaytimePlayerStatus = {
  status: MinimumPlaytimeStatus;
  playedSeconds: number;
  playedMinutes: number;
  requiredMinutes: number;
  missingSeconds: number;
};

export function getMinimumPlaytimePlayerStatus(
  playedSeconds: number,
  requiredMinutes: number,
): MinimumPlaytimePlayerStatus {
  const required = minimumPlaytimeSecondsFromMinutes(requiredMinutes);
  const played = Math.max(0, Math.floor(playedSeconds));
  const missingSeconds = Math.max(0, required - played);
  const playedMinutes = Math.floor(played / 60);
  let status: MinimumPlaytimeStatus = 'ok';
  if (missingSeconds > 0) {
    status = played <= 0 ? 'critical' : 'warning';
  }
  return {
    status,
    playedSeconds: played,
    playedMinutes,
    requiredMinutes: normalizeMinimumPlaytimeMinutes(requiredMinutes),
    missingSeconds,
  };
}

/**
 * Restspielzeit vs. fehlende Mindestspielzeit:
 * - missing_minutes > remaining_minutes → kritisch
 * - missing_minutes >= remaining_minutes - 3 → dringend
 */
export function getMinimumPlaytimeUrgency(
  playedSeconds: number,
  requiredMinutes: number,
  /** Verbleibende effektive Spielzeit bis Spielende (ohne Pausen). */
  remainingMatchSeconds: number,
): MinimumPlaytimeUrgency {
  const base = getMinimumPlaytimePlayerStatus(playedSeconds, requiredMinutes);
  if (base.missingSeconds <= 0) return 'ok';

  const missingMinutes = Math.ceil(base.missingSeconds / 60);
  const remainingMinutes = Math.floor(Math.max(0, remainingMatchSeconds) / 60);

  if (missingMinutes > remainingMinutes) return 'critical';
  if (missingMinutes >= remainingMinutes - 3) return 'urgent';
  if (base.playedSeconds <= 0) return 'warning';
  return 'warning';
}

export function isMinimumPlaytimeUrgent(urgency: MinimumPlaytimeUrgency): boolean {
  return urgency === 'urgent' || urgency === 'critical';
}

export function minimumPlaytimeUrgencyRank(urgency: MinimumPlaytimeUrgency): number {
  if (urgency === 'critical') return 0;
  if (urgency === 'urgent') return 1;
  if (urgency === 'warning') return 2;
  return 3;
}

export function formatMinimumPlaytimeProgress(playedMinutes: number, requiredMinutes: number): string {
  return `${playedMinutes} / ${normalizeMinimumPlaytimeMinutes(requiredMinutes)} min`;
}

export function formatMissingMinutesLabel(missingSeconds: number): string {
  const m = Math.ceil(missingSeconds / 60);
  if (m <= 0) return '';
  return m === 1 ? 'fehlt 1 min' : `fehlen ${m} min`;
}

export function isBelowMinimumPlaytime(playedSeconds: number, requiredMinutes: number): boolean {
  return getMinimumPlaytimePlayerStatus(playedSeconds, requiredMinutes).missingSeconds > 0;
}
