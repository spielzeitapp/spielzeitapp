import assert from 'node:assert/strict';
import { tournamentLivestreamLinksInText } from '../src/lib/tournamentLivestreamLinkText.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tournamentLivestreamEmbedUrl } from '../server/lib/tournamentLivestream.js';

const videoId = 'AbCd1234_-Z';
const printedUrl = `www.youtube.com/watch?v=${videoId}`;
assert.deepEqual(tournamentLivestreamLinksInText(`Hier ansehen: ${printedUrl}`), [`https://${printedUrl}`]);
assert.deepEqual(tournamentLivestreamLinksInText(`(${printedUrl}).\n${printedUrl}`), [`https://${printedUrl}`]);
assert.deepEqual(tournamentLivestreamLinksInText(`Livestream youtu.be/${videoId}`), [`https://youtu.be/${videoId}`]);
assert.deepEqual(tournamentLivestreamLinksInText('www.youtube.com/… www.youtube.com/watch?v=ab...'), []);
assert.deepEqual(tournamentLivestreamLinksInText('www.youtube.com http://www.provider.example/live https://user@www.provider.example/live'), []);
assert.deepEqual(tournamentLivestreamLinksInText('https://provider.example/stream https://other.example/video'), [
  'https://provider.example/stream', 'https://other.example/video',
]);
for (const url of [
  `https://www.youtube.com/watch?v=${videoId}&feature=share`,
  `https://youtu.be/${videoId}?si=share`,
  `https://m.youtube.com/live/${videoId}`,
  `https://www.youtube-nocookie.com/embed/${videoId}`,
]) {
  assert.equal(tournamentLivestreamEmbedUrl(url), `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`);
}

const uid = 'fc5d2eb9d083a97be477b7cfb8804073';
for (const hostname of ['customer-example.cloudflarestream.com', 'iframe.videodelivery.net']) {
  const player = `https://${hostname}/${uid}/iframe`;
  assert.equal(tournamentLivestreamEmbedUrl(player + '?controls=true'), player + '?autoplay=true');
}
const signedPlayer = 'https://customer-example.cloudflarestream.com/head.body.signature/iframe';
assert.equal(tournamentLivestreamEmbedUrl(signedPlayer), signedPlayer + '?autoplay=true');

for (const url of [
  null,
  'https://organizer.example/hallencup',
  `http://www.youtube.com/watch?v=${videoId}`,
  `https://www.youtube.com.bad.example/watch?v=${videoId}`,
  `https://example@www.youtube.com/watch?v=${videoId}`,
  `https://www.youtube.com:3000/watch?v=${videoId}`,
  `https://www.youtube-nocookie.com/watch?v=${videoId}`,
  'https://www.youtube.com/watch?v=short',
  `https://customer-example.cloudflarestream.com/${uid}/manifest/video.m3u8`,
]) {
  assert.equal(tournamentLivestreamEmbedUrl(url), null, String(url));
}
console.log('PASS known livestream players, signed Cloudflare player and unsupported URL fallback');

const require = createRequire(import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'tournament-stream-'));
try {
  const bundle = join(dir, 'view.cjs');
  await require('esbuild').build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        export { default as React } from 'react';
        export { default as TestRenderer, act } from 'react-test-renderer';
        export { MemoryRouter, Routes, Route } from 'react-router-dom';
        export { PublicTeamTournamentPage } from './src/pages/public/PublicTeamTournamentPage';
        export { TournamentLivestreamShare } from './src/components/tournament/TournamentLivestreamShare';
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logOverride: { 'empty-import-meta': 'silent' },
    outfile: bundle,
    define: { 'import.meta.env': '{}' },
    plugins: [{
      name: 'supabase-fixture',
      setup(build) {
        build.onResolve({ filter: /TournamentPlanQrScannerSheet$/ }, () => ({
          path: 'scanner', namespace: 'fixture',
        }));
        build.onResolve({ filter: /tournamentLivestreamPhotoOcr$/ }, () => ({
          path: 'ocr', namespace: 'fixture',
        }));
        build.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
        build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: args.path === 'scanner' ? 'export const TournamentPlanQrScannerSheet = () => null;'
            : args.path === 'ocr' ? 'export const scanTournamentLivestreamPhoto = async () => globalThis.scannedLinks;'
            : `export const supabase = {
            rpc: async () => ({ data: { canScreen: false, canManage: false } }),
            auth: {
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
              getSession: async () => ({ data: { session: { user: { id: 'trainer' }, access_token: 'token' } } })
            },
            from: table => {
              if (table === 'team_seasons') {
                return { select: () => ({ eq: () => ({ single: async () => ({ data: { team_id: 'team' } }) }) }) };
              }
              if (table === 'team_feed_posts') {
                return { insert: async row => { globalThis.savedTournamentVideos.push(row); return { error: null }; } };
              }
              throw new Error('Unerwartete Tabelle: ' + table);
            }
          };`,
        }));
      },
    }],
  });

  const { React, TestRenderer, act, MemoryRouter, Routes, Route, PublicTeamTournamentPage, TournamentLivestreamShare } = require(bundle);
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  let refresh;
  globalThis.window = {
    location: { origin: 'https://app.spielzeitapp.at', hostname: 'app.spielzeitapp.at' },
    addEventListener() {},
    removeEventListener() {},
    setInterval(callback) { refresh = callback; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
  };
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };

  const page = {
    publicId: 'fixture',
    tournamentName: 'Hallencup TEST',
    teamName: 'Rohrbach',
    dateLabel: '27. November',
    ageGroupLabel: 'U12',
    allMatches: [],
    results: [],
    upcomingMatches: [],
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, page: { ...page } }) });
  const { createElement: h } = React;
  let scrollCount = 0;
  let view;
  await act(async () => {
    view = TestRenderer.create(h(MemoryRouter, { initialEntries: ['/turnier/fixture#livestream'] },
      h(Routes, null, h(Route, { path: '/turnier/:publicId', element: h(PublicTeamTournamentPage) }))), {
      createNodeMock: node => node.props.id === 'livestream'
        ? { scrollIntoView() { scrollCount++; } }
        : null,
    });
  });

  assert.equal(view.root.findAllByProps({ id: 'livestream' }).length, 0, 'no stream section without a link');
  page.livestreamUrl = `https://www.youtube.com/live/${videoId}`;
  await act(async () => refresh());
  const stream = view.root.findByProps({ id: 'livestream' });
  assert.equal(scrollCount, 1, 'deep link scrolls to the stream once it loads');
  assert.equal(stream.findAllByType('iframe').length, 0, 'no third-party frame before a click');
  await act(async () => stream.findByType('button').props.onClick());
  const frame = stream.findByType('iframe');
  assert.equal(frame.props.src, tournamentLivestreamEmbedUrl(page.livestreamUrl));
  const ticker = stream.parent.children[stream.parent.children.indexOf(stream) + 1];
  assert.equal(ticker.findByType('h2').props.children, 'Unser Turnier-Liveticker', 'ticker directly follows player');
  await act(async () => refresh());
  assert.equal(stream.findByType('iframe'), frame, 'polling keeps the player mounted');
  assert.equal(scrollCount, 1, 'ordinary polling does not jump the viewport');
  assert.equal(stream.findByType('a').props.href, page.livestreamUrl);
  await act(async () => stream.findByType('button').props.onClick());
  assert.equal(stream.findAllByType('iframe').length, 0, 'closing removes the frame');

  page.livestreamUrl = 'https://organizer.example/hallencup';
  await act(async () => refresh());
  assert.equal(stream.findAllByType('iframe').length, 0);
  assert.equal(stream.findByType('a').props.href, page.livestreamUrl, 'unknown providers open externally');
  await act(async () => view.unmount());
  console.log('PASS no-link state, deep link, click-to-load, ticker, polling and provider fallback');

  page.tournamentStatus = 'finished';
  page.livestreamUrl = `https://youtu.be/${videoId}`;
  await act(async () => {
    view = TestRenderer.create(h(MemoryRouter, { initialEntries: ['/turnier/fixture'] },
      h(Routes, null, h(Route, { path: '/turnier/:publicId', element: h(PublicTeamTournamentPage) }))));
  });
  const replay = view.root.findByProps({ id: 'livestream' });
  assert.equal(replay.findByType('h2').props.children, 'Turnieraufzeichnung');
  assert.equal(replay.findByType('iframe').props.title, 'Turnieraufzeichnung');
  assert.equal(replay.findByType('iframe').props.src, tournamentLivestreamEmbedUrl(page.livestreamUrl, { autoplay: false }));
  const initialTicker = replay.parent.children[replay.parent.children.indexOf(replay) + 1];
  assert.equal(initialTicker.findByType('h2').props.children, 'Unser Turnier-Liveticker');
  page.recordingParts = ['https://www.youtube.com/watch?v=bYeY33rVWjM', page.livestreamUrl];
  await act(async () => refresh());
  const parts = replay.findByProps({ 'aria-label': 'Teile der Turnieraufzeichnung' }).findAllByType('button');
  assert.equal(parts.length, 2);
  assert.equal(parts[0].props['aria-pressed'], true);
  assert.equal(replay.findByType('iframe').props.src, tournamentLivestreamEmbedUrl(page.recordingParts[0], { autoplay: false }));
  await act(async () => parts[0].props.onClick());
  assert.equal(replay.findByType('iframe').props.src, tournamentLivestreamEmbedUrl(page.recordingParts[0]));
  await act(async () => parts[1].props.onClick());
  assert.equal(replay.findByType('iframe').props.src, tournamentLivestreamEmbedUrl(page.recordingParts[1]));
  await act(async () => replay.findAllByType('button').find(b => b.props.children === 'Player schließen').props.onClick());
  await act(async () => refresh());
  assert.equal(replay.findAllByType('iframe').length, 0, 'polling respects a closed recording');
  await act(async () => view.unmount());

  await act(async () => {
    view = TestRenderer.create(h(MemoryRouter, null, h(PublicTeamTournamentPage, {
      embedded: true, publicIdOverride: 'fixture',
    })));
  });
  assert.equal(view.root.findByType('iframe').props.src, tournamentLivestreamEmbedUrl(page.recordingParts[0], { autoplay: false }));
  await act(async () => view.unmount());

  globalThis.savedTournamentVideos = [];
  globalThis.fetch = async () => assert.fail('saving a recording must not send a push');
  await act(async () => {
    view = TestRenderer.create(h(TournamentLivestreamShare, {
      eventId: 'finished-event', teamSeasonId: 'season', recording: true,
    }));
  });
  await act(async () => view.root.findByProps({ inputMode: 'url' }).props.onChange({ target: { value: page.livestreamUrl } }));
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(globalThis.savedTournamentVideos.length, 1);
  assert.equal(globalThis.savedTournamentVideos[0].post_kind, 'tournament_recording');
  assert.equal(globalThis.savedTournamentVideos[0].event_id, 'finished-event');
  assert.equal(globalThis.savedTournamentVideos[0].cta_url, page.livestreamUrl);
  assert.equal(view.root.findByProps({ role: 'status' }).props.children, 'Aufzeichnung auf der Turnierseite gespeichert.');
  await act(async () => view.unmount());
  console.log('PASS finished tournament replay and saving a recording without a push');

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, skipped: true }) });
  const coverUrl = 'https://images.example.org/hallencup.jpg';
  const participantLogo = 'https://images.example.org/wilhelmsburg.png';
  await act(async () => {
    view = TestRenderer.create(h(TournamentLivestreamShare, {
      eventId: 'upcoming-event', teamSeasonId: 'season', recording: false, coverUrl,
      participants: [
        { team_name: 'ASK Peham Wilhelmsburg schwarz', logo_url: participantLogo },
        { team_name: 'ASK Peham Wilhelmsburg weiß', logo_url: participantLogo },
      ],
    }));
  });
  const urlField = view.root.findByProps({ inputMode: 'url' });
  const imageField = view.root.findByProps({ capture: 'environment' });
  const photo = { currentTarget: { files: [{ type: 'image/jpeg' }], value: 'photo.jpg' } };
  globalThis.scannedLinks = [page.livestreamUrl, 'https://other.example/video'];
  await act(async () => imageField.props.onChange(photo));
  assert.equal(urlField.props.value, '', 'multiple links require a new photo');
  globalThis.scannedLinks = [page.livestreamUrl];
  await act(async () => imageField.props.onChange(photo));
  assert.equal(urlField.props.value, page.livestreamUrl);
  assert.equal(globalThis.savedTournamentVideos.length, 1, 'a photo only fills the field');
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  const announcement = globalThis.savedTournamentVideos[1];
  assert.equal(announcement.media_url, coverUrl);
  assert.equal(announcement.media_type, 'image');
  assert.equal(announcement.cta_label, 'Zur Turnierseite');
  assert.deepEqual(announcement.payload.participants, [
    { name: 'ASK Peham Wilhelmsburg schwarz', logoUrl: participantLogo },
    { name: 'ASK Peham Wilhelmsburg weiß', logoUrl: participantLogo },
  ]);
  await act(async () => view.unmount());
  console.log('PASS pre-event announcement stores title image, CTA and both Wilhelmsburg teams');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.exit(0);
