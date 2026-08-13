/**
 * Client state that must not leak between auth users (trainer → parent, etc.).
 * Invite stash keys are intentionally NOT cleared here so Magic-Link → Login keeps context.
 */

export const ACCOUNT_SCOPED_LOCAL_STORAGE_KEYS = [
  'spielzeit_team_season_id',
  'spielzeit_team',
  'spielzeit_role',
  'spz_preview_role',
  'spz_selected_parent_child_id',
  'sz_schedule_team',
] as const;

export function clearAccountScopedClientState(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of ACCOUNT_SCOPED_LOCAL_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
