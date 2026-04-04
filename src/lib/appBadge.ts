/** PWA / installiertes Home-Screen (z. B. iPhone): Badging API — optional, stiller Fallback. */

const BADGE_CAP = 99;

function safeSetAppBadge(count: number): void {
  if (typeof navigator === 'undefined' || typeof navigator.setAppBadge !== 'function') return;
  const n = Math.min(Math.max(0, Math.floor(count)), BADGE_CAP);
  if (n <= 0) return;
  void navigator.setAppBadge(n).catch((e) => {
    console.warn('[appBadge] setAppBadge', e);
  });
}

function safeClearAppBadge(): void {
  if (typeof navigator === 'undefined' || typeof navigator.clearAppBadge !== 'function') return;
  void navigator.clearAppBadge().catch((e) => {
    console.warn('[appBadge] clearAppBadge', e);
  });
}

/**
 * Eine zentrale Stelle: OS-/PWA-Badge = Unread-Count des eingeloggten Users.
 * Keine Reminder-Logik — nur Anzeige.
 */
export function syncNotificationBadge(count: number): void {
  try {
    if (count > 0) safeSetAppBadge(count);
    else safeClearAppBadge();
  } catch (e) {
    console.warn('[appBadge] syncNotificationBadge', e);
  }
}

/** @deprecated Alias — nutze syncNotificationBadge */
export function syncAppIconBadgeFromUnreadCount(unreadCount: number): void {
  syncNotificationBadge(unreadCount);
}
