/** Badging API (PWA / installiertes iPhone): optional, stiller Fallback. */

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

/** Synchron mit Unread-Count (eine Quelle). */
export function syncAppIconBadgeFromUnreadCount(unreadCount: number): void {
  try {
    if (unreadCount > 0) safeSetAppBadge(unreadCount);
    else safeClearAppBadge();
  } catch (e) {
    console.warn('[appBadge] sync', e);
  }
}
