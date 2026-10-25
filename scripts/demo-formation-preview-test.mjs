import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  stdin: {
    contents: `export { DemoFormationPreview, DEMO_FORMATION_SYSTEMS, DEMO_FORMATION_LAYOUTS } from './src/demo/components/DemoFormationPreview';
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
const { DemoFormationPreview, DEMO_FORMATION_SYSTEMS, DEMO_FORMATION_LAYOUTS, buildDemoPlayers } = compiledModule.exports;
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
  assert.ok(html.includes('Formation ändern'));
  assert.ok(html.includes('Schließen'));
  assert.ok(html.includes('aria-pressed="true"'));
  assert.equal((html.match(/<select/g) || []).length, 1, 'only format uses dropdown');
  for (const player of players) assert.ok(html.includes(player.last_name), `missing ${player.last_name}`);
  assert.ok(!html.includes('Spieler</span>'), 'actual names must render');
  assert.ok(!html.includes('>–</text>'), 'actual jersey numbers must render');
  assert.doesNotThrow(() => render(players.map(player => ({ ...player, display_name: '', first_name: null, last_name: null, jersey_number: null }))));
  for (const system of DEMO_FORMATION_SYSTEMS[format]) {
    assert.equal(system.split('-').map(Number).reduce((sum, n) => sum + n, 1), Number(format));
  }
}
console.log('Demo formation preview: actual demo roster and missing-name cases passed.');

for (const [system, layout] of Object.entries(DEMO_FORMATION_LAYOUTS)) {
  assert.equal(layout.length, system.split('-').map(Number).reduce((sum, n) => sum + n, 1));
  assert.equal(layout.filter(p => p.label === 'TW').length, 1);
  assert.equal(new Set(layout.map(p => `${p.x}:${p.y}`)).size, layout.length);
}
for (const system of ['4-4-2', '3-3-2', '3-5-2']) {
  const strikers = DEMO_FORMATION_LAYOUTS[system].filter(p => p.label === 'ST');
  assert.equal(strikers.length, 2);
  assert.ok(strikers.every(p => p.x >= 35 && p.x <= 65), 'central strike pair');
}
assert.deepEqual(DEMO_FORMATION_LAYOUTS['4-4-2'].filter(p => p.y === 44).map(p => p.label), ['LM', 'ZM', 'ZM', 'RM']);
assert.equal(DEMO_FORMATION_LAYOUTS['4-2-3-1'].filter(p => p.label === 'DM').length, 2);
