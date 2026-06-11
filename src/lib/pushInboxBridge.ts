import { requestInboxSync } from './notificationsReadState';

const INBOX_REFRESH_MESSAGE_TYPES = new Set(['SPZ_PUSH_RECEIVED', 'SPZ_NOTIFICATION_CLICK']);

/**
 * Service Worker → Inbox aus Supabase neu laden (Badge, Mehr, Nachrichten-Liste), kein Full Reload.
 */
export function registerServiceWorkerInboxBridge(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const t = event.data && typeof event.data === 'object' ? (event.data as { type?: unknown }).type : null;
    if (typeof t === 'string' && INBOX_REFRESH_MESSAGE_TYPES.has(t)) {
      requestInboxSync();
    }
  });
}
