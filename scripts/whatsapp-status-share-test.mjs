import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../src/lib/whatsAppStatusShare.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/m, '').replaceAll('export async function', 'async function');
const blob = new Blob(['image'.repeat(40)], { type: 'image/png' });
const { prepareWhatsAppStatusFile, shareWhatsAppStatusFile } = new Function(
  'matchdayPosterDomToPngBlob',
  stripTypeScriptTypes(source) + '\nreturn { prepareWhatsAppStatusFile, shareWhatsAppStatusFile };'
)(async () => blob);
const originalFetch = globalThis.fetch;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const setNavigator = value => Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
try {
  const signed = 'https://example.test/image?token=PRIVATE';
  globalThis.fetch = async url => { assert.equal(url, signed); return new Response(blob); };
  const file = await prepareWhatsAppStatusFile({ querySelector: selector => selector.includes('-image') ? { src: signed } : null });
  assert.equal(file.type, 'image/png');
  const videoBlob = new Blob(['video'.repeat(40)], { type: 'video/mp4' });
  globalThis.fetch = async url => { assert.equal(url, signed); return new Response(videoBlob); };
  const videoFile = await prepareWhatsAppStatusFile({ querySelector: selector => selector.includes('-video') ? { currentSrc: signed } : null });
  assert.equal(videoFile.name, 'spielzeit-status.mp4');
  assert.equal(videoFile.type, 'video/mp4');
  globalThis.fetch = async () => new Response(blob);
  let shared;
  setNavigator({ canShare: () => true, share: async data => { shared = data; } });
  assert.equal(await shareWhatsAppStatusFile(file), 'shared');
  assert.deepEqual(Object.keys(shared), ['files']);
  assert.equal(shared.files[0], file);
  assert.ok(!JSON.stringify(shared).includes('PRIVATE'));
  setNavigator({ share: async () => { throw new DOMException('cancel', 'AbortError'); } });
  assert.equal(await shareWhatsAppStatusFile(file), 'aborted');
  assert.equal(await prepareWhatsAppStatusFile({ querySelector: () => null }), null);
  const rendered = await prepareWhatsAppStatusFile({ querySelector: selector => selector.includes('-poster') ? {} : null });
  assert.equal(rendered.name, 'spielzeit-status.png');
  globalThis.fetch = async () => new Response('not an image');
  assert.equal(await prepareWhatsAppStatusFile({ querySelector: () => ({ src: signed }) }), null);
  let download;
  globalThis.document = { createElement: () => ({ click() { download = { href: this.href, name: this.download }; } }) };
  globalThis.window = { setTimeout: callback => { callback(); } };
  setNavigator({});
  assert.equal(await shareWhatsAppStatusFile(file), 'downloaded');
  assert.equal(download.name, file.name);
  assert.ok(download.href.startsWith('blob:'));
  setNavigator({ share: async () => {}, canShare: () => { throw new Error('unsupported'); } });
  assert.equal(await shareWhatsAppStatusFile(file), 'downloaded');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
}
for (const name of ['Matchday', 'Result', 'NextMatch', 'Lineup', 'Live', 'Squad', 'Image']) {
  const card = readFileSync(new URL('../src/components/feed/' + name + 'FeedPostCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /inFooter whatsAppStatus/);
}
const typography = readFileSync(new URL('../src/components/feed/feedTypography.tsx', import.meta.url), 'utf8');
assert.match(typography, /whatsAppStatus = true/);
assert.match(typography, /onShareFallback={onShare}/);
const videoCard = readFileSync(new URL('../src/components/feed/VideoFeedPostCard.tsx', import.meta.url), 'utf8');
assert.match(videoCard, /data-whatsapp-status-video/);
for (const name of ['ChampionshipSchedule', 'TournamentCompletion']) {
  const card = readFileSync(new URL('../src/components/feed/' + name + 'FeedPostCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /<FeedPostShareActions post={post}/);
}
console.log('PASS: status shares image only, poster rendering, cancellation, download fallback, all graphic feed cards');
