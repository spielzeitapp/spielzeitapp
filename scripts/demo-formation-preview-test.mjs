import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  stdin: {
    contents: `export { DemoFormationPreview, DEMO_FORMATION_SYSTEMS } from './src/demo/components/DemoFormationPreview';
      export { buildDemoPlayers } from './src/demo/demoPlayers';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  plugins: [{ name: 'no-database-in-render-test', setup(build) {
    build.onLoad({ filter: /supabaseClient\.ts$/ }, () => ({ contents: 'export const supabase = new Proxy({}, { get() { throw new Error("Unexpected database access in demo rendering test"); } });', loader: 'ts' }));
  } }],
  external: ['react'], define: { 'import.meta.env': '{}' },
});
const require = createRequire(import.meta.url);
const compiledModule = { exports: {} };
new Function('require', 'exports', 'module', result.outputFiles[0].text)(require, compiledModule.exports, compiledModule);
const { DemoFormationPreview, DEMO_FORMATION_SYSTEMS, buildDemoPlayers } = compiledModule.exports;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const players = buildDemoPlayers();
assert.equal(players.length, 12);
for (const format of ['7', '9', '11']) {
  const render = rows => renderToStaticMarkup(React.createElement(DemoFormationPreview, {
    players: rows, format, onFormatChange: () => {},
  }));
  const html = render(players);
  if (format === '7') continue;
  assert.ok(html.includes(`${format} Spieler am Feld`));
  for (const player of players) assert.ok(html.includes(player.last_name), `missing ${player.last_name}`);
  assert.ok(!html.includes('Spieler</span>'), 'actual names must render');
  assert.ok(!html.includes('>–</text>'), 'actual jersey numbers must render');
  assert.doesNotThrow(() => render(players.map(player => ({ ...player, display_name: '', first_name: null, last_name: null, jersey_number: null }))));
  for (const system of DEMO_FORMATION_SYSTEMS[format]) {
    assert.equal(system.split('-').map(Number).reduce((sum, n) => sum + n, 1), Number(format));
  }
}
console.log('Demo formation preview: actual demo roster and missing-name cases passed.');
