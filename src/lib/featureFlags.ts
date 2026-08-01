/**
 * Feature-Flag für saisonfähiges Kadermodell (team_season_players).
 * Default true (STEP 5) — Join-Read über team_season_players + players-Stamm.
 * Multi-Season-Kader (z. B. Soft-Lock U11 + aktive U12) braucht Join.
 * Abschalten: VITE_ROSTER_JOIN_V1=false oder localStorage spz_roster_join_v1=0
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

  // STEP 5: Join default an (Soft-Lock + neue Saison gleichzeitig sichtbar)
  return true;
}
