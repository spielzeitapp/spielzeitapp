/**
 * Feature-Flag für saisonfähiges Kadermodell (team_season_players).
 * Default false — Legacy-Read über players.team_season_id.
 * true — Dual-Read über team_season_players + players-Stamm (STEP 4).
 *
 * Aktivierung:
 * - VITE_ROSTER_JOIN_V1=true (Client / Staging-Env)
 * - oder localStorage spz_roster_join_v1=1 (Dev-Override)
 */
export const ROSTER_JOIN_V1_STORAGE_KEY = 'spz_roster_join_v1';

export function isRosterJoinV1Enabled(): boolean {
  const env = String(import.meta.env.VITE_ROSTER_JOIN_V1 ?? '')
    .trim()
    .toLowerCase();
  if (env === 'true' || env === '1' || env === 'yes') return true;
  if (env === 'false' || env === '0' || env === 'no') return false;

  if (typeof window !== 'undefined') {
    try {
      const ls = window.localStorage.getItem(ROSTER_JOIN_V1_STORAGE_KEY);
      if (ls === '1' || ls === 'true') return true;
      if (ls === '0' || ls === 'false') return false;
    } catch {
      // ignore
    }
  }

  // STEP 3 Default: aus
  return false;
}
