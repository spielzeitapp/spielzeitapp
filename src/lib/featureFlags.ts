/**
 * Feature-Flag für saisonfähiges Kadermodell (team_season_players).
 *
 * Read-Pfad (listRoster): Join ist Standard, sobald die Tabelle technisch verfügbar ist.
 * Legacy nur als Fallback bei technischem Ausfall / Hard-Disable.
 *
 * Hard-Rollback (Notfall): VITE_ROSTER_JOIN_V1=false
 * localStorage darf Join NICHT abschalten (sonst leere Soft-Lock-Kader nach Saisonwechsel).
 * localStorage spz_roster_join_v1=1 erzwingt Join weiterhin (Dev).
 */
export const ROSTER_JOIN_V1_STORAGE_KEY = 'spz_roster_join_v1';

function parseEnvFlag(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return null;
}

/** Explizites Notfall-Aus via Build-Env (nicht via Browser-localStorage). */
export function isRosterJoinV1HardDisabled(): boolean {
  return parseEnvFlag(String(import.meta.env.VITE_ROSTER_JOIN_V1 ?? '')) === false;
}

/**
 * Ob Join-Read bevorzugt werden soll.
 * Default: an. Hard-Disable nur über VITE_ROSTER_JOIN_V1=false.
 */
export function isRosterJoinV1Enabled(): boolean {
  if (isRosterJoinV1HardDisabled()) return false;

  const env = parseEnvFlag(String(import.meta.env.VITE_ROSTER_JOIN_V1 ?? ''));
  if (env === true) return true;

  if (typeof window !== 'undefined') {
    try {
      const ls = window.localStorage.getItem(ROSTER_JOIN_V1_STORAGE_KEY);
      // Nur Opt-in über localStorage — Opt-out wird ignoriert (historische Kader schützen)
      if (ls === '1' || ls === 'true') return true;
    } catch {
      // ignore
    }
  }

  return true;
}
