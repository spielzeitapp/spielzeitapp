import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const result = await build({
  stdin: {
    contents: `import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {SquadPosterArtwork} from './src/components/feed/SquadPosterArtwork';
      export function render(players, photo) {
        return renderToStaticMarkup(React.createElement(SquadPosterArtwork, {
          left: {name: 'SPG Rohrbach', logo: '/original-home.svg'},
          right: {name: 'SPG Bischofstetten', logo: '/original-away.svg'},
          ageGroup: 'U12', startsAt: '2026-10-09T14:30:00Z', location: 'Sportplatz Rohrbach',
          players, teamPhotoUrl: photo,
        }));
      }`,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['react', 'react-dom/server'], loader: { '.css': 'empty' },
});
const require = createRequire(import.meta.url);
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
for (const count of [0, 1, 11, 20]) {
  const players = Array.from({length: count}, (_, i) => ({player_id: String(i), name: i === 0 ? 'Nino Semellechner' : `Spieler ${i}`, jersey_number: i + 1}));
  const html = module.exports.render(players, '/team/photo.webp');
  assert.equal((html.match(/<li>/g) || []).length, count);
  assert.ok(html.includes(`${count} Spieler im Kader`));
  assert.ok(html.includes('original-home.svg') && html.includes('original-away.svg'));
  assert.ok(html.includes('16:30 Uhr'));
  assert.ok(html.includes('data-whatsapp-status-poster'));
  assert.ok(html.includes('squad-poster-photo'));
  if (count) assert.ok(html.includes('Nino Semellechner'));
}
assert.ok(!module.exports.render([], null).includes('squad-poster-photo'));
const css = readFileSync('src/components/feed/squadPoster.css', 'utf8');
assert.ok(css.includes('object-fit: contain'));
assert.ok(!css.includes('text-overflow: ellipsis'));
console.log('Squad poster: dynamic counts, original logos, Vienna time, photo fallback and export marker passed.');
