/**
 * iPhone / PWA Homescreen: Badging API (Progressive Enhancement).
 * Nur Anzeige — gleicher Unread wie useUnreadCount (user_id des eingeloggten Users).
 */

const BADGE_CAP = 99;

/** OS-Badge entfernen; bei fehlender API still ignorieren. */
export async function clearAppBadgeSafe(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.clearAppBadge !== 'function') return;
    await navigator.clearAppBadge();
    console.log('[badge] cleared');
  } catch {
    /* ignore */
  }
}

/**
 * Homescreen-Badge = ungelesene Notifications (aktueller User).
 * unreadCount <= 0 → clearAppBadgeSafe()
 */
export async function syncAppBadge(unreadCount: number): Promise<void> {
  try {
    const raw = Math.floor(Number(unreadCount));
    if (!Number.isFinite(raw) || raw <= 0) {
      await clearAppBadgeSafe();
      return;
    }
    if (typeof navigator === 'undefined' || typeof navigator.setAppBadge !== 'function') return;
    const n = Math.min(raw, BADGE_CAP);
    await navigator.setAppBadge(n);
    console.log('[badge] synced', n);
  } catch {
    /* ignore — App darf nicht crashen */
  }
}
