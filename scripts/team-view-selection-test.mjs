import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const ReactDOM = require('react-dom');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');

async function bundle(entry, plugins = []) {
  const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', jsx: 'transform', define: { 'import.meta.env.BASE_URL': '"/"' }, tsconfigRaw: { compilerOptions: { jsx: 'react' } }, plugins });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
  return mod.exports;
}

const { resolveTeamViewSeasonIds } = await bundle('src/lib/teamViewSelection.ts');
const seasons = [
  { id: 'u12', status: 'active', age_group: 'U12', team: { id: 'a', name: 'SPG Rohrbach' }, season: { name: '2026/27' } },
  { id: 'km', status: 'active', age_group: 'KM', team: { id: 'b', name: 'USC Rohrbach' }, season: { name: '2026/27' } },
  { id: 'u11', status: 'archived', age_group: 'U11', team: { id: 'a', name: 'SPG Rohrbach' }, season: { name: '2025/26' } },
  { id: 'draft', status: 'draft', team: { id: 'c', name: 'Vorbereitung' } },
];
assert.deepEqual(resolveTeamViewSeasonIds(seasons, 'all', 'u12'), ['u12', 'km']);
assert.deepEqual(resolveTeamViewSeasonIds(seasons, ['u12', 'km', 'unknown', 'u11', 'draft'], 'u12'), ['u12', 'km']);
assert.deepEqual(resolveTeamViewSeasonIds(seasons, null, 'u11'), ['u11']);
assert.deepEqual(resolveTeamViewSeasonIds(seasons, null, 'unknown'), []);
assert.deepEqual(resolveTeamViewSeasonIds([], 'all', null), []);

const { TeamSwitcher } = await bundle('src/app/components/TeamSwitcher.tsx', [{
  name: 'session-fixture',
  setup(api) {
    api.onResolve({ filter: /auth\/useSession$/ }, () => ({ path: 'session-fixture', namespace: 'fixture' }));
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function useSession() { return globalThis.__teamViewTestSession; }', loader: 'js' }));
  },
}]);

const oldState = React.useState;
const oldElement = React.createElement;
const oldPortal = ReactDOM.createPortal;
const oldDocument = globalThis.document;
const oldWarn = console.error;
let captured = [];
const calls = [];
React.useState = (initial) => oldState(initial === false ? true : initial);
React.createElement = (type, props, ...children) => {
  if (type === 'input' || type === 'button') captured.push({ type, props, children });
  return oldElement(type, props, ...children);
};
ReactDOM.createPortal = (element) => element;
globalThis.document = { body: {} };
console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect')) oldWarn(...args); };
try {
  const session = {
    teamSeasons: seasons, selectedTeamSeasonId: 'u12', viewTeamSeasonId: 'u12',
    memberships: seasons.map((s) => ({ team_season_id: s.id, role: 'fan' })),
    teamViewFilter: null, filteredTeamSeasonIds: ['u12'],
    setTeamViewFilter: (filter) => calls.push(['filter', filter]),
    setSelectedTeamSeasonId: (id) => calls.push(['work', id]),
    setViewTeamSeasonId: (id) => calls.push(['view', id]),
  };
  const render = (url = '/app/termine') => {
    captured = []; calls.length = 0;
    globalThis.__teamViewTestSession = session;
    return renderToStaticMarkup(oldElement(MemoryRouter, { initialEntries: [url] }, oldElement(TeamSwitcher, { compact: true })));
  };
  let html = render();
  assert(html.includes('Mannschaft &amp; Saison'));
  assert(html.includes('aria-modal="true"'));
  assert(html.includes('Alle Mannschaften'));
  assert(html.includes('type="checkbox"'));
  assert(!html.includes('<select'));
  captured.find((x) => x.type === 'input' && x.props['aria-label'].includes('USC Rohrbach')).props.onChange();
  assert.deepEqual(calls, [['filter', ['u12', 'km']]], 'multi-selection must not change write season');
  render();
  captured.find((x) => x.type === 'button' && x.children.includes('Alle Mannschaften')).props.onClick();
  assert.deepEqual(calls, [['filter', 'all']]);
  session.teamViewFilter = 'all'; session.filteredTeamSeasonIds = ['u12', 'km'];
  html = render(); assert(html.includes('Alle Mannschaften'));
  captured.find((x) => x.type === 'input' && x.props['aria-label'].includes('USC Rohrbach')).props.onChange();
  assert.deepEqual(calls, [['work', 'u12'], ['filter', null]]);
  render('/app/team');
  assert(!captured.some((x) => x.type === 'input'), 'team administration stays single-team');
  const archiveRow = captured.find((x) => x.type === 'button' && JSON.stringify(x.children).includes('U11'));
  archiveRow.props.onClick();
  assert.deepEqual(calls, [['filter', null], ['view', 'u11']], 'archive must not change write season');
  session.teamSeasons = []; session.teamViewFilter = null;
  html = render(); assert(html.includes('Keine Mannschaften'));
  console.log('team-view-selection-test: OK (scope, archive isolation, fan multi-selection, single-team management, dark menu, empty state)');
} finally {
  React.useState = oldState; React.createElement = oldElement; ReactDOM.createPortal = oldPortal;
  globalThis.document = oldDocument; console.error = oldWarn;
  delete globalThis.__teamViewTestSession;
}
