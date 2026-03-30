export const NOTIFICATIONS_READ_CHANGED_EVENT = 'spz_notifications_read_changed';

export function notifyNotificationsReadChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_CHANGED_EVENT));
}

