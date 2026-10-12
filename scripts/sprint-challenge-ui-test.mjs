import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const compiled = await build({ entryPoints: ['src/pages/SprintChallengePage.tsx'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, jsx: 'transform', tsconfigRaw: { compilerOptions: { jsx: 'react' } }, plugins: [{
 name: 'sprint-fixtures', setup(api) {
  api.onResolve({ filter: /^react$/ }, () => ({ path: 'react', external: true }));
  api.onResolve({ filter: /hooks\/(useActiveTeamSeason|usePlayers|useSprintChallenge)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'fixture' }));
  api.onResolve({ filter: /^\.\.\/ui$/ }, () => ({ path: 'ui', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents:
   args.path === 'useActiveTeamSeason' ? "export function useActiveTeamSeason(){return {activeTeamSeasonId:'season',isHistoryReadOnly:false,role:'trainer',loading:false};}" :
   args.path === 'usePlayers' ? "export function usePlayers(){return {players:[{id:'a',display_name:'Paul Gasteiner'},{id:'b',display_name:'Theo Putz'}],loading:false};}" :
   args.path === 'useSprintChallenge' ? "export function useSprintChallenge(){return globalThis.sprintFixture;}" :
   "import React from 'react'; export function PageShell({children}){return React.createElement('main',null,children);} export function PremiumCard({children}){return React.createElement('section',null,children);}"
  }));
 }
}] });
const mod = { exports: {} };
new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
const render = method => {
 globalThis.sprintFixture = {tests:[{id:'test',start_date:'2026-10-12',event_id:null,measurement_method:method}],testId:'test',results:{},loading:false,saving:false,error:null,setTestId(){},createTest(){},save(){},setMeasurementMethod(){}};
 return renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(mod.exports.SprintChallengePage)));
};
const hand = render('hand');
assert(hand.includes('Stoppuhr öffnen (optional)'));
assert(!hand.includes('>Start</button>'), 'stopwatch starts collapsed');
assert(!hand.includes('<select'), 'selection stays in app style');
assert(hand.includes('Speichern &amp; nächster Spieler'));
assert(hand.includes('0 von 3 Versuchen erfasst'));
const light = render('light_gate');
assert(!light.includes('Stoppuhr öffnen'));
assert(light.includes('Lichtschranken-Zeiten direkt eintragen'));
const old = render(null);
assert(old.includes('Messart für diesen Test festlegen'));
assert(!old.includes('>Start</button>'));
delete globalThis.sprintFixture;
console.log('Sprint UI OK: optional timer, direct light-gate input, dark selection, next-player action, unclassified legacy tests.');
