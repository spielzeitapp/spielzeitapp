/** Standard-Mindestspielzeit pro Spiel (Minuten). */
export const DEFAULT_MINIMUM_PLAYTIME_MINUTES = 20;

export type MinimumPlaytimeStatus = 'ok' | 'warning' | 'critical';

export function normalizeMinimumPlaytimeMinutes(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_MINIMUM_PLAYTIME_MINUTES;
  return Math.min(90, Math.max(1, n));
}

export function minimumPlaytimeSecondsFromMinutes(minutes: number): number {
  return normalizeMinimumPlaytimeMinutes(minutes) * 60;
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
