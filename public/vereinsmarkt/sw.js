/* Each club has its own registration, badge and notification destination. */
const clubId = new URL(self.registration.scope).pathname.split('/').filter(Boolean).at(-1);
const clubPath = '/vereinsmarkt/' + clubId;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (!payload || payload.kind !== 'exchange' || payload.clubId !== clubId) return;

  const count = payload.badge_count;
  const url = new URL(clubPath, self.location.origin);
  url.searchParams.set('view', 'member');
  url.searchParams.set('mode', 'requests');
  if (/^[0-9a-f-]{36}$/i.test(payload.threadId ?? '')) url.searchParams.set('thread', payload.threadId);
  event.waitUntil(Promise.allSettled([
    self.registration.showNotification('Vereinsmarkt', {
      body: 'Neue Anfrage oder Nachricht zu einem Inserat.',
      icon: '/vereinsmarkt/icon-192.png',
      tag: payload.tag,
      data: { url: url.href },
    }),
    Promise.resolve().then(() => {
      if (!Number.isInteger(count) || count < 0) return;
      return count > 0 ? self.navigator.setAppBadge?.(Math.min(count, 99)) : self.navigator.clearAppBadge?.();
    }),
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) client.postMessage({ type: 'SPZ_PUSH_RECEIVED' });
    }),
  ]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) event.waitUntil(self.clients.openWindow(url));
});
