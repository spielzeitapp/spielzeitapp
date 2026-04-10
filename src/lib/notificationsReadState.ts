export const NOTIFICATIONS_READ_CHANGED_EVENT = 'spz_notifications_read_changed';

/** Push/SW: Listen & Badge neu laden, ohne als gelesen zu markieren. */
export const INBOX_SYNC_EVENT = 'spz_inbox_sync';

export function notifyNotificationsReadChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_CHANGED_EVENT));
}

export function requestInboxSync(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(INBOX_SYNC_EVENT));
}

