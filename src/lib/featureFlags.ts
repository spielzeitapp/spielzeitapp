/**
 * Feature-Flag für saisonfähiges Kadermodell (team_season_players).
 * STEP 3: Default false — App bleibt auf players.team_season_id.
 * STEP 4+: true schaltet Join-Reads frei (noch nicht verdrahtet in usePlayers).
 *
 * Aktivierung:
 * - VITE_ROSTER_JOIN_V1=true (Client)
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
