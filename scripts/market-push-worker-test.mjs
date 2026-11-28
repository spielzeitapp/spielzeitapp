import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const clubId = '9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
const domain = 'https://spielzeitapp.test';
const clubPath = `/vereinsmarkt/${clubId}`;

function serviceWorker(file, scope) {
  const handlers = new Map();
  const badges = [];
  const shown = [];
  const opened = [];
  const self = {
    registration: {
      scope: domain + scope,
      showNotification: async (title, options) => shown.push({ title, options }),
    },
    location: { origin: domain },
    navigator: {
      setAppBadge: async value => badges.push(value),
      clearAppBadge: async () => badges.push(0),
    },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
    addEventListener: (name, fn) => handlers.set(name, fn),
  };
  runInNewContext(readFileSync(file, 'utf8'), { self, URL, console });
  const send = (name, event) => {
    let promise;
    handlers.get(name)({ ...event, waitUntil: work => { promise = work; } });
    return promise;
  };
  return { badges, shown, opened, send, push: payload => send('push', { data: { json: () => payload } }) };
}

const market = serviceWorker('public/vereinsmarkt/sw.js', clubPath);
await market.push({ kind: 'reminder', clubId, badge_count: 5 });
await market.push({ kind: 'exchange', clubId: 'other', badge_count: 5 });
assert.deepEqual(market.badges, []);
assert.deepEqual(market.shown, []);
const threadId = '36e2ed05-68bc-4b44-a460-0832cef12341';
await market.push({ kind: 'exchange', clubId, threadId, badge_count: 2 });
await market.push({ kind: 'exchange', clubId, badge_count: 0 });
assert.deepEqual(market.badges, [2, 0]);
const target = new URL(market.shown[0].options.data.url);
assert.equal(target.pathname, clubPath);
assert.equal(target.searchParams.get('thread'), threadId);
await market.send('notificationclick', { notification: { data: { url: target.href }, close() {} } });
assert.deepEqual(market.opened, [target.href]);

const app = serviceWorker('public/sw.js', '/');
await app.push({ data: { kind: 'exchange', badge_count: 6 } });
assert.deepEqual(app.badges, []);
assert.deepEqual(app.shown, []);
await app.push({ data: { kind: 'reminder', badge_count: 3 } });
assert.deepEqual(app.badges, [3]);
assert.equal(app.shown.length, 1);
console.log('PASS: market, club and regular app push/badge isolation');
