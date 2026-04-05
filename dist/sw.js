/* eslint-disable no-restricted-globals */
/**
 * Web Push → sichtbare System-Notification (iOS PWA / Android / Desktop).
 * Ohne event.data oder ohne JSON trotzdem Notification (Background).
 */
const DEFAULT_TITLE = 'SpielzeitApp';
const DEFAULT_BODY = 'Neue Benachrichtigung';
const DEFAULT_URL_PATH = '/app/termine';
const DEFAULT_ICON = '/icon-192.png';
const DEFAULT_BADGE = '/badge-72.png';
const DEFAULT_TAG = 'spielzeitapp';
const DEFAULT_VIBRATE = [200, 100, 200];

function parsePayloadData(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

function readBadgeCountFromPayload(payload) {
  const data = parsePayloadData(payload.data);
  const candidates = [
    payload.appBadgeCount,
    payload.unread_count,
    payload.badge_count,
    data.unread_count,
    data.badge_count,
    data.appBadgeCount,
  ];
  for (const c of candidates) {
    const n = typeof c === 'string' && c.trim() !== '' ? Number(c.trim()) : Number(c);
    if (Number.isFinite(n)) {
      const i = Math.floor(n);
      if (i >= 0) return i;
    }
  }
  return NaN;
}

function applyAppBadgeFromCount(n) {
  try {
    const nav = self.navigator;
    if (!nav || typeof nav.setAppBadge !== 'function' || typeof nav.clearAppBadge !== 'function') return;
    if (!Number.isFinite(n)) return;
    const i = Math.floor(n);
    if (i <= 0) {
      void nav.clearAppBadge().catch(() => {});
      return;
    }
    void nav.setAppBadge(Math.min(99, i)).catch(() => {});
  } catch {
    /* ignore */
  }
}

function parsePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    try {
      const t = event.data.text();
      return t ? JSON.parse(t) : {};
    } catch {
      return {};
    }
  }
}

function resolveOpenUrl(pathOrUrl) {
  const raw = (pathOrUrl || '').trim() || DEFAULT_URL_PATH;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return new URL(path, self.location.origin).href;
}

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event);

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : DEFAULT_TITLE;

  const body =
    typeof payload.body === 'string' && payload.body.trim()
      ? payload.body.trim()
      : DEFAULT_BODY;

  const dataObj = parsePayloadData(payload.data);
  const fromData = typeof dataObj.url === 'string' ? dataObj.url.trim() : '';
  const fromTop = typeof payload.url === 'string' ? payload.url.trim() : '';
  let path = fromTop || fromData || DEFAULT_URL_PATH;
  if (!path.startsWith('/') && !/^https?:\/\//i.test(path)) {
    path = `/${path}`;
  }

  const tag =
    typeof payload.tag === 'string' && payload.tag.trim() ? payload.tag.trim() : DEFAULT_TAG;

  const icon =
    typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : DEFAULT_ICON;
  const badge =
    typeof payload.badge === 'string' && payload.badge.trim() ? payload.badge.trim() : DEFAULT_BADGE;

  let vibrate = DEFAULT_VIBRATE;
  if (Array.isArray(payload.vibrate) && payload.vibrate.length > 0) {
    const nums = payload.vibrate.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
    if (nums.length > 0) vibrate = nums;
  }

  const badgeCount = readBadgeCountFromPayload(payload);
  const dataPayload = Object.assign({}, dataObj, { url: path });
  if (Number.isFinite(badgeCount)) {
    dataPayload.unread_count = badgeCount;
    dataPayload.badge_count = badgeCount;
  }

  const options = {
    body,
    icon,
    badge,
    tag,
    vibrate,
    lang: 'de',
    renotify: true,
    silent: false,
    requireInteraction: false,
    data: dataPayload,
  };

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options);
      } catch (e) {
        console.error('[sw] showNotification failed', e);
      }
      applyAppBadgeFromCount(badgeCount);
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: 'SPZ_PUSH_RECEIVED' });
        }
      } catch {
        /* ignore */
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let path = DEFAULT_URL_PATH;
  if (data && typeof data === 'object' && typeof data.url === 'string' && data.url.trim()) {
    path = data.url.trim();
  }
  const targetUrl = resolveOpenUrl(path);

  event.waitUntil(
    (async () => {
      try {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const origin = self.location.origin;
        for (const c of all) {
          if (c.url && c.url.startsWith(origin) && 'postMessage' in c) {
            c.postMessage({ type: 'SPZ_NOTIFICATION_CLICK' });
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const origin = self.location.origin;
        const sameOrigin = list.filter((c) => c.url && c.url.startsWith(origin));
        const win =
          sameOrigin.find((c) => 'focused' in c && c.focused) ||
          sameOrigin.find((c) => 'visibilityState' in c && c.visibilityState === 'visible') ||
          sameOrigin[0];
        if (win && 'focus' in win) {
          if (typeof win.navigate === 'function') {
            await win.navigate(targetUrl);
          }
          return await win.focus();
        }
      } catch {
        /* openWindow */
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
