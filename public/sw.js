/* eslint-disable no-restricted-globals */
/**
 * Service Worker: Web Push empfangen und System-Benachrichtigung anzeigen.
 * Klick öffnet die App-URL aus data.url (z. B. /app/events/<id>).
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
      ? payload.title
      : 'Spielzeit';
  const body =
    typeof payload.body === 'string' && payload.body.trim()
      ? payload.body
      : 'Neue Benachrichtigung';
  const url =
    typeof payload.url === 'string' && payload.url.startsWith('/')
      ? payload.url
      : '/app/schedule';
  const tag =
    typeof payload.tag === 'string' && payload.tag.trim()
      ? payload.tag
      : 'spielzeit-notification';

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    renotify: true,
    data: { url },
  };

  /** iOS/PWA: Homescreen-Badge sofort (ohne App zu öffnen), Wert kommt vom Server = unread notifications. */
  function applyAppBadgeFromPayload(p) {
    try {
      const nav = self.navigator;
      if (!nav || typeof nav.setAppBadge !== 'function' || typeof nav.clearAppBadge !== 'function') return;
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

  /** URL aus showNotification({ data: { url } }) – gleiches Format wie Push-Payload (z. B. /termine). */
  const data = event.notification.data;
  let path = '/app/schedule';
  if (data && typeof data === 'object' && typeof data.url === 'string' && data.url.trim()) {
    path = data.url.trim();
  }

  event.waitUntil(
    (async () => {
      const origin = self.location.origin;
      const absolute = path.startsWith('http') ? path : origin + path;

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

      for (const client of list) {
        if (!('focus' in client) || !client.url.startsWith(origin)) continue;
        try {
          if (typeof client.navigate === 'function') {
            await client.navigate(absolute);
          }
          return await client.focus();
        } catch {
          /* navigate nicht unterstützt oder fehlgeschlagen → neues Fenster */
          break;
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
