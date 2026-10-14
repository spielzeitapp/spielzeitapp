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
const DEFAULT_TAG_FALLBACK = 'spielzeitapp';
const DEFAULT_VIBRATE = [200, 100, 200];

/** Kategorien, die als „wichtig“ gelten (Banner bleibt länger sichtbar). */
const REQUIRE_INTERACTION_KINDS = new Set(['reminder', 'team_push', 'manual_push', 'debug_parent_push']);

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
  const nav = self.navigator;
  if (!nav || typeof nav.setAppBadge !== 'function' || typeof nav.clearAppBadge !== 'function') {
    return Promise.resolve();
  }
  if (!Number.isFinite(n)) {
    return Promise.resolve();
  }
  const i = Math.floor(n);
  if (i <= 0) {
    return nav.clearAppBadge().catch((e) => {
      console.warn('[sw] clearAppBadge failed', e);
    });
  }
  return nav.setAppBadge(Math.min(99, i)).catch((e) => {
    console.warn('[sw] setAppBadge failed', e);
  });
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

/** iOS PWA: Icon/Badge-URLs absolut (relative Pfade schlagen im SW-Kontext fehl). */
function absoluteAssetUrl(pathOrUrl) {
  const s = (pathOrUrl || '').trim();
  if (!s) return new URL(DEFAULT_ICON, self.location.origin).href;
  if (/^https?:\/\//i.test(s)) return s;
  const p = s.startsWith('/') ? s : `/${s}`;
  return new URL(p, self.location.origin).href;
}

/** Stabiler Tag: Server-`tag` oder aus Deep-Link / event_id (ohne pro-Gerät-Zufall). */
function resolveNotificationTag(payload, dataObj, path) {
  const fromPayload = typeof payload.tag === 'string' ? payload.tag.trim() : '';
  if (fromPayload) return fromPayload.slice(0, 128);
  const ev = dataObj.event_id;
  if (typeof ev === 'string' && /^[0-9a-f-]{36}$/i.test(ev.trim())) {
    return `spz-ev-${ev.trim()}`;
  }
  const p = (path || DEFAULT_URL_PATH).replace(/^\/+/, '').replace(/[^a-zA-Z0-9/_-]/g, '_').slice(0, 80);
  if (p) return `spz-${p}`;
  return DEFAULT_TAG_FALLBACK;
}

function resolveVibrate(payload) {
  const v = payload.vibrate;
  if (Array.isArray(v) && v.length > 0) {
    const nums = v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 10_000);
    if (nums.length > 0) return nums;
  }
  return DEFAULT_VIBRATE;
}

function shouldRequireInteraction(payload, dataObj) {
  if (payload.requireInteraction === true) return true;
  if (payload.requireInteraction === false) return false;
  const kind = typeof dataObj.kind === 'string' ? dataObj.kind.trim() : '';
  if (kind && REQUIRE_INTERACTION_KINDS.has(kind)) return true;
  return false;
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

  const iconRel =
    typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : DEFAULT_ICON;
  const badgeRel =
    typeof payload.badge === 'string' && payload.badge.trim() ? payload.badge.trim() : DEFAULT_BADGE;

  const icon = absoluteAssetUrl(iconRel);
  const badge = absoluteAssetUrl(badgeRel);

  const vibrate = resolveVibrate(payload);

  const badgeCount = readBadgeCountFromPayload(payload);
  const notificationTag = resolveNotificationTag(payload, dataObj, path);

  const dataPayload = { ...dataObj, url: path };
  if (Number.isFinite(badgeCount)) {
    dataPayload.unread_count = badgeCount;
    dataPayload.badge_count = badgeCount;
  }

  const requireInteraction = shouldRequireInteraction(payload, dataObj);

  const options = {
    body,
    icon,
    badge,
    tag: notificationTag,
    vibrate,
    lang: 'de',
    renotify: true,
    silent: false,
    requireInteraction,
    data: dataPayload,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options).catch((e) => {
        console.error('[sw] showNotification failed', e);
      }),
      applyAppBadgeFromCount(badgeCount),
    ]).then(() =>
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'SPZ_PUSH_RECEIVED' });
          }
        })
        .catch((e) => {
          console.warn('[sw] postMessage SPZ_PUSH_RECEIVED failed', e);
        }),
    ),
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

/** Explicit offline preparation: cache only the public standalone player, never API responses. */
const SPEAKER_OFFLINE_CACHE='spz-speaker-offline-v1';
self.addEventListener('message',event=>{
 if(event.data?.type!=='SPZ_PREPARE_SPEAKER_OFFLINE')return;
 event.waitUntil((async()=>{
  try{const cache=await caches.open(SPEAKER_OFFLINE_CACHE);const response=await fetch('/sprecher-offline.html',{cache:'reload'});if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('Offline player missing');await cache.put('/sprecher-offline.html',response);event.ports[0]?.postMessage({ok:true});}
  catch{event.ports[0]?.postMessage({ok:false});}
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname!=='/sprecher-offline.html')return;
 event.respondWith((async()=>{try{const response=await fetch(event.request);if(response.ok)return response;}catch{}const cache=await caches.open(SPEAKER_OFFLINE_CACHE);return (await cache.match('/sprecher-offline.html'))??new Response('Bitte das Sprecherstudio zuerst online öffnen und Offline vorbereiten wählen.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});})());
});
