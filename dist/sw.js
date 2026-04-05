/* eslint-disable no-restricted-globals */
/**
 * Service Worker: Web Push empfangen und System-Benachrichtigung anzeigen.
 * Klick öffnet data.url bzw. Payload-URL (z. B. /app/termine).
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    try {
      const t = event.data && event.data.text();
      payload = t ? JSON.parse(t) : {};
    } catch {
      payload = {};
    }
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : 'Spielzeit';

  const body =
    typeof payload.body === 'string' && payload.body.trim()
      ? payload.body.trim()
      : 'Neue Benachrichtigung';

  const fromData =
    payload.data && typeof payload.data === 'object' && typeof payload.data.url === 'string'
      ? payload.data.url.trim()
      : '';
  const fromTop = typeof payload.url === 'string' ? payload.url.trim() : '';
  let path = fromTop || fromData || '/app/nachrichten';
  if (!path.startsWith('/') && !/^https?:\/\//i.test(path)) {
    path = `/${path}`;
  }

  const tag =
    typeof payload.tag === 'string' && payload.tag.trim()
      ? payload.tag.trim()
      : 'spielzeit-notification';

  const defaultIcon = '/icon-192.png';
  const icon =
    typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : defaultIcon;
  const badge =
    typeof payload.badge === 'string' && payload.badge.trim() ? payload.badge.trim() : defaultIcon;

  let vibrate = [160, 100, 160, 100, 280];
  if (Array.isArray(payload.vibrate) && payload.vibrate.length > 0) {
    const nums = payload.vibrate.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
    if (nums.length > 0) vibrate = nums;
  }

  const dataPayload =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? Object.assign({}, payload.data, { url: path })
      : { url: path };

  const options = {
    body,
    icon,
    badge,
    tag,
    vibrate,
    renotify: true,
    silent: false,
    requireInteraction: false,
    data: dataPayload,
  };

  /** Nur wenn der Server eine Zahl schickt = gleiche Quelle wie In-App-Unread (notifications). */
  function applyAppBadgeFromPayload(p) {
    try {
      const nav = self.navigator;
      if (!nav || typeof nav.setAppBadge !== 'function' || typeof nav.clearAppBadge !== 'function')
        return;
      const raw = p && typeof p.appBadgeCount === 'number' ? p.appBadgeCount : NaN;
      if (!Number.isFinite(raw)) return;
      const n = Math.floor(raw);
      if (n <= 0) {
        void nav.clearAppBadge().catch(() => {});
        return;
      }
      void nav.setAppBadge(Math.min(99, n)).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    (async () => {
      applyAppBadgeFromPayload(payload);
      await self.registration.showNotification(title, options);
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
  let path = '/app/nachrichten';
  if (data && typeof data === 'object' && typeof data.url === 'string' && data.url.trim()) {
    path = data.url.trim();
  }

  event.waitUntil(
    (async () => {
      const origin = self.location.origin;
      const absolute = path.startsWith('http') ? path : origin + (path.startsWith('/') ? path : `/${path}`);

      const list = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      try {
        for (const client of list) {
          if (client.url && client.url.startsWith(origin)) {
            client.postMessage({ type: 'SPZ_NOTIFICATION_CLICK' });
          }
        }
      } catch {
        /* ignore */
      }

      const sameOrigin = list.filter((c) => c.url && c.url.startsWith(origin));
      const target =
        sameOrigin.find((c) => 'focused' in c && c.focused) ||
        sameOrigin.find((c) => 'visibilityState' in c && c.visibilityState === 'visible') ||
        sameOrigin[0];

      if (target && 'focus' in target) {
        try {
          if (typeof target.navigate === 'function') {
            await target.navigate(absolute);
          }
          return await target.focus();
        } catch {
          /* neues Fenster */
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute);
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
