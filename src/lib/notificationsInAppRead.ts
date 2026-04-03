/**
 * Client-only „gelesen“ für `public.notifications`, wenn die DB kein `user_id` / `read`
 * hat oder RLS kein Update erlaubt — gleiches Muster wie messagesReadState.
 */
export const NOTIFICATIONS_READ_STORAGE_PREFIX = 'spz_read_notifications:';

function keyForUser(userId: string): string {
  return `${NOTIFICATIONS_READ_STORAGE_PREFIX}${userId}`;
}

export function readNotificationReadSet(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function writeNotificationReadSet(userId: string, set: Set<string>): void {
  try {
    window.localStorage.setItem(keyForUser(userId), JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function markNotificationReadLocal(userId: string, notificationId: string): void {
  const s = readNotificationReadSet(userId);
  s.add(notificationId);
  writeNotificationReadSet(userId, s);
}

export function markAllNotificationsReadLocal(userId: string, ids: string[]): void {
  const s = readNotificationReadSet(userId);
  for (const id of ids) s.add(id);
  writeNotificationReadSet(userId, s);
}

export function isNotificationUnreadLocal(userId: string, notificationId: string): boolean {
  return !readNotificationReadSet(userId).has(notificationId);
}
