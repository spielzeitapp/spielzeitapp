import { notifyNotificationsReadChanged } from './notificationsReadState';

const INBOX_REFRESH_MESSAGE_TYPES = new Set(['SPZ_PUSH_RECEIVED', 'SPZ_NOTIFICATION_CLICK']);

/**
 * Service Worker meldet eingehenden Push / Notification-Klick → Unread neu laden (useUnreadCount + PWA-Badge).
 * Keine zweite Notification, nur Refresh der bestehenden Inbox-Queries.
 */
export function registerServiceWorkerInboxBridge(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const t = event.data && typeof event.data === 'object' ? (event.data as { type?: unknown }).type : null;
    if (typeof t === 'string' && INBOX_REFRESH_MESSAGE_TYPES.has(t)) {
      notifyNotificationsReadChanged();
    }
  });
}
