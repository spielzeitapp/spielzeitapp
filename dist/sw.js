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

  event.waitUntil(self.registration.showNotification(title, options));
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
