import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tournamentLivestreamEmbedUrl } from '../server/lib/tournamentLivestream.js';

const videoId = 'AbCd1234_-Z';
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
        build.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
        build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: args.path === 'scanner' ? 'export const TournamentPlanQrScannerSheet = () => null;' : `export const supabase = {
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
  assert(replay.findByType('button').props.children.includes('Aufzeichnung ansehen'));
  await act(async () => replay.findByType('button').props.onClick());
  assert.equal(replay.findByType('iframe').props.title, 'Turnieraufzeichnung');
  await act(async () => view.unmount());

  globalThis.savedTournamentVideos = [];
  globalThis.fetch = async () => assert.fail('saving a recording must not send a push');
  await act(async () => {
    view = TestRenderer.create(h(TournamentLivestreamShare, {
      eventId: 'finished-event', teamSeasonId: 'season', recording: true,
    }));
  });
  await act(async () => view.root.findByType('input').props.onChange({ target: { value: page.livestreamUrl } }));
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(globalThis.savedTournamentVideos.length, 1);
  assert.equal(globalThis.savedTournamentVideos[0].post_kind, 'tournament_recording');
  assert.equal(globalThis.savedTournamentVideos[0].event_id, 'finished-event');
  assert.equal(globalThis.savedTournamentVideos[0].cta_url, page.livestreamUrl);
  assert.equal(view.root.findByProps({ role: 'status' }).props.children, 'Aufzeichnung auf der Turnierseite gespeichert.');
  await act(async () => view.unmount());
  console.log('PASS finished tournament replay and saving a recording without a push');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
