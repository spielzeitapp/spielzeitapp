/**
 * Einheitliches JSON für Web Push → public/sw.js (showNotification).
 * Keine DB-Abhängigkeit.
 */

export const DEFAULT_PUSH_ICON = '/icon-192.png';
/** Monochromes kleines Icon für Statusleiste / iOS (72×72). */
export const DEFAULT_PUSH_BADGE = '/badge-72.png';

/** Kurzes Muster – iOS ignoriert vibrate teils, Android nutzt es. */
export const DEFAULT_PUSH_VIBRATE: readonly number[] = [200, 100, 200];

/**
 * Relative Pfade in die SPA unter /app/... bringen (alte Links wie /termine).
 */
export function normalizeWebPushAppPath(url: string | undefined | null): string {
  let t = (url ?? '').trim();
  if (!t) return '/app/termine';
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
  /** Banner bleibt sichtbar bis Nutzer tippt (iOS/Android). */
  requireInteraction?: boolean;
  /** Für sw.js: requireInteraction-Heuristik + stabiler Tag-Fallback. */
  kind?: string;
  eventId?: string;
}): string {
  const path = normalizeWebPushAppPath(parts.url);
  const title = (parts.title || 'SpielzeitApp').trim() || 'SpielzeitApp';
  const body = (parts.body || 'Neue Benachrichtigung').trim() || 'Neue Benachrichtigung';
  const tag =
    typeof parts.tag === 'string' && parts.tag.trim() ? parts.tag.trim().slice(0, 128) : 'spielzeitapp';

  const data: Record<string, unknown> = { url: path };
  if (parts.kind && String(parts.kind).trim()) {
    data.kind = String(parts.kind).trim();
  }
  if (parts.eventId && String(parts.eventId).trim()) {
    data.event_id = String(parts.eventId).trim();
  }

  const o: Record<string, unknown> = {
    title,
    body,
    url: path,
    tag,
    requireInteraction: parts.requireInteraction === true,
    icon: DEFAULT_PUSH_ICON,
    badge: DEFAULT_PUSH_BADGE,
    vibrate: [...DEFAULT_PUSH_VIBRATE],
    data: { ...data },
  };

  if (typeof parts.appBadgeCount === 'number' && Number.isFinite(parts.appBadgeCount)) {
    const c = Math.min(99, Math.max(0, Math.floor(parts.appBadgeCount)));
    o.appBadgeCount = c;
    o.unread_count = c;
    o.badge_count = c;
    o.data = { ...data, unread_count: c, badge_count: c };
  }
  return JSON.stringify(o);
}
