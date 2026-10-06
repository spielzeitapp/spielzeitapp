import assert from 'node:assert/strict';
import { shareFeedContent } from '../src/lib/feedShare.ts';
import { buildMatchdayShareText, compactMatchdayCaption } from '../src/lib/matchdayShareText.ts';

const signed = 'https://project.supabase.co/storage/v1/object/sign/team-feed/poster.webp?token=TEST_ONLY';
const text = '⚽ HEIMSPIEL\nTeam A vs. Team B';
const file = new File(['image'.repeat(30)], 'poster.png', { type: 'image/png' });
const originalFetch = globalThis.fetch;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let calls = [];
function setNavigator(value) { Object.defineProperty(globalThis, 'navigator', { configurable: true, value }); }
try {
  setNavigator({ canShare: () => true, share: async data => { calls.push(data); } });
  assert.equal(await shareFeedContent({ title: 'Spieltag', text, file, fetchUrl: signed }), 'shared');
  assert.equal(calls[0].files[0], file);
  assert.equal(calls[0].text, text);
  assert.ok(!('url' in calls[0]));
  assert.ok(!JSON.stringify(calls).includes('TEST_ONLY'));

  // Internal fetch URL is used only for obtaining the attachment.
  calls = [];
  globalThis.fetch = async url => { assert.equal(url, signed); return new Response(new Blob(['image'.repeat(30)], { type: 'image/webp' })); };
  assert.equal(await shareFeedContent({ title: 'Spieltag', text, fetchUrl: signed, fileName: 'poster.webp' }), 'shared');
  assert.equal(calls[0].files[0].type, 'image/webp');
  assert.ok(!JSON.stringify(calls).includes('TEST_ONLY'));

  // Failed download or unsupported attachment -> clean text, not raw signed link.
  globalThis.fetch = async () => { throw new Error('offline'); };
  calls = [];
  assert.equal(await shareFeedContent({ title: 'Spieltag', text, fetchUrl: signed }), 'shared');
  assert.deepEqual(calls, [{ title: 'Spieltag', text }]);
  calls = [];
  setNavigator({ canShare: data => !data.files, share: async data => {
    if (data.files) throw new Error('unsupported');
    calls.push(data);
  } });
  assert.equal(await shareFeedContent({ title: 'Spieltag', text, file, fetchUrl: signed }), 'shared');
  assert.deepEqual(calls, [{ title: 'Spieltag', text }]);

  let copied;
  setNavigator({ clipboard: { writeText: async value => { copied = value; } } });
  assert.equal(await shareFeedContent({ title: 'Spieltag', text, file, fetchUrl: signed }), 'copied');
  assert.equal(copied, text);
  setNavigator({ share: async () => { throw new DOMException('cancel', 'AbortError'); },
    clipboard: { writeText: async () => { throw new Error('must not copy after cancel'); } } });
  assert.equal(await shareFeedContent({ title: 'Spieltag', text, file }), 'aborted');
} finally {
  globalThis.fetch = originalFetch;
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  else delete globalThis.navigator;
}

const caption = '🔴⚫ SPIELTAG – HEIMSPIEL! ⚽\n\nLanger Motivationstext.\n\n⚽ Team A vs. Team B\n🕕 Anpfiff: 18:00 Uhr\n📍 Sportplatz Rohrbach\n📅 06.10.2026\n\n#GemeinsamEinTeam';
const compact = compactMatchdayCaption(caption);
assert.ok(compact.length < caption.length);
assert.ok(!compact.includes('Langer Motivationstext'));
for (const fact of ['Team A vs. Team B', '18:00 Uhr', 'Sportplatz Rohrbach', '06.10.2026']) assert.ok(compact.includes(fact));
assert.equal(compactMatchdayCaption('Normales Teamfoto\n\nBeschreibung'), 'Normales Teamfoto\n\nBeschreibung');
assert.equal(compactMatchdayCaption('HEIMSPIEL mit wichtigem Hinweis'), 'HEIMSPIEL mit wichtigem Hinweis');
const announcement = buildMatchdayShareText({ home: 'Team A', away: 'Team B', startsAt: '2026-10-06T16:00:00Z', isHome: true, location: 'Sportplatz Rohrbach' });
assert.ok(announcement.includes('18:00 Uhr'));
assert.ok(announcement.includes('06.10.2026'));
assert.ok(!announcement.includes('https://'));
assert.ok(!buildMatchdayShareText({ home: 'A', away: 'B', startsAt: 'invalid', isHome: false }).includes('Invalid'));
console.log('PASS: file+text, internal download, clean fallbacks, cancellation, compact facts, Vienna time');
