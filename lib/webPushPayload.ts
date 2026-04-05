/**
 * Einheitliches JSON für Web Push → public/sw.js (showNotification).
 * Keine DB-Abhängigkeit.
 */

export const DEFAULT_PUSH_ICON = '/icon-192.png';
/** Gleiche Datei wie Icon ok; OS maskiert fürs Status-Badge wo unterstützt. */
export const DEFAULT_PUSH_BADGE = '/icon-192.png';

/** Kurzes Doppel-Pattern (näher an „neue Nachricht“ als ein langer Summton). */
export const DEFAULT_PUSH_VIBRATE: readonly number[] = [160, 100, 160, 100, 280];

/**
 * Relative Pfade in die SPA unter /app/... bringen (alte Links wie /termine).
 */
export function normalizeWebPushAppPath(url: string | undefined | null): string {
  let t = (url ?? '').trim();
  if (!t) return '/app/nachrichten';
  if (/^https?:\/\//i.test(t)) return t;
  if (!t.startsWith('/')) t = `/${t}`;
  if (t === '/termine' || t.startsWith('/termine?') || t.startsWith('/termine#')) {
    return `/app/termine${t.slice('/termine'.length)}`;
  }
  if (t === '/schedule' || t.startsWith('/schedule?') || t.startsWith('/schedule#')) {
    return `/app/termine${t.slice('/schedule'.length)}`;
  }
  if (t === '/nachrichten' || t.startsWith('/nachrichten?') || t.startsWith('/nachrichten#')) {
    return `/app/nachrichten${t.slice('/nachrichten'.length)}`;
  }
  return t;
}

export function buildWebPushJsonPayload(parts: {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Nur setzen, wenn aus derselben Quelle wie useUnreadCount (notifications.read). */
  appBadgeCount?: number;
}): string {
  const path = normalizeWebPushAppPath(parts.url);
  const o: Record<string, unknown> = {
    title: parts.title,
    body: parts.body,
    url: path,
    tag: parts.tag,
    icon: DEFAULT_PUSH_ICON,
    badge: DEFAULT_PUSH_BADGE,
    vibrate: [...DEFAULT_PUSH_VIBRATE],
    data: { url: path },
  };
  if (typeof parts.appBadgeCount === 'number' && Number.isFinite(parts.appBadgeCount)) {
    o.appBadgeCount = Math.min(99, Math.max(0, Math.floor(parts.appBadgeCount)));
  }
  return JSON.stringify(o);
}
