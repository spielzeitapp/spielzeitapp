import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
const result = await build({ entryPoints: ['src/manager/mobile/ManagerMobileMorePage.tsx'], bundle: true,
  write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', plugins: [{
    name: 'contexts', setup(b) {
      b.onResolve({ filter: /AuthProvider$|useProfile$|useSession$|ManagerWorkModeContext$/ }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents:
        a.path.endsWith('AuthProvider') ? 'export const useAuth = () => ({user:{id:"staff"}});'
          : a.path.endsWith('useProfile') ? 'export const useProfile=()=>({profile:null}); export const getDisplayFirstName=()=>"Trainer"; export const profileDisplayName=()=>"Trainer";'
            : a.path.endsWith('useSession') ? 'export const useSession=()=>globalThis.importTestSession;'
              : 'export const useManagerWorkMode=()=>globalThis.importTestMode;' }));
    },
  }] });
const m = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, m, m.exports);
function render(selected, view = null, mode = 'trainer', allowed = [selected, view].filter(Boolean)) {
  globalThis.importTestSession = { selectedTeamSeason: selected, viewTeamSeason: view };
  globalThis.importTestMode = { workMode: mode, isTrainerMode: mode === 'trainer', availableModes: [mode], contextTeamSeasons: allowed };
  return renderToStaticMarkup(React.createElement(StaticRouter, {location:'/manager/mehr'}, React.createElement(m.exports.ManagerMobileMorePage)));
}
const active = {id:'current-season', status:'active'};
const archive = {id:'archived-season', status:'archived'};
assert.ok(render(active).includes('href="/manager/saisons/current-season/oefb-import"'));
const historical = render(active, archive);
assert.ok(historical.includes('Diese Saison ist archiviert'));
assert.ok(!historical.includes('/oefb-import"'));
assert.ok(!render(active, null, 'platform_admin').includes('/oefb-import"'));
assert.ok(!render(active, null, 'trainer', []).includes('/oefb-import"'));
assert.ok(render(null).includes('Bitte zuerst oben eine Mannschaft und Saison wählen'));
assert.ok(render(active, null, 'club_admin').includes('/current-season/oefb-import"'));
delete globalThis.importTestSession;
delete globalThis.importTestMode;
console.log('PASS: current season, archive blocked, missing or foreign context and role-specific import entry');
