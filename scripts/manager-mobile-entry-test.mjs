import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', plugins: [{
      name: 'manager-context', setup(b) {
        b.onResolve({ filter: /.*/, namespace: 'router-stub' }, a => ({ path: a.path, external: true }));
        b.onResolve({ filter: /ManagerWorkModeContext$|ManagerDashboardPage$/ }, a => ({ path: a.path, namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents:
          a.path.endsWith('ManagerDashboardPage') ? 'export const ManagerDashboardPage = () => "Desktop-Dashboard";'
            : 'export const useManagerWorkMode = () => globalThis.managerMobileContext;' }));
        b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'router-stub' }));
        b.onLoad({ filter: /.*/, namespace: 'router-stub' }, () => ({ contents:
          'const r = require("react-router-dom"); Object.assign(exports, r); exports.Navigate = ({to}) => require("react").createElement("span", {"data-destination":to});' }));
      },
    }] });
  const m = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, m, m.exports);
  return m.exports;
}
const { ManagerHomeRoute } = await load('src/manager/ManagerHomeRoute.tsx');
const { ManagerMobileNav } = await load('src/manager/components/ManagerMobileNav.tsx');
function render(Component, workMode, mobile, supportSession = null) {
  globalThis.managerMobileContext = { workMode, supportSession };
  globalThis.window = { matchMedia: () => ({ matches: mobile }) };
  return renderToStaticMarkup(React.createElement(StaticRouter, { location: '/manager/training/einheiten' }, React.createElement(Component)));
}
assert.match(render(ManagerHomeRoute, 'trainer', true), /data-destination="\/manager\/training\/einheiten"/);
assert.match(render(ManagerHomeRoute, 'trainer', false), /Desktop-Dashboard/);
assert.match(render(ManagerHomeRoute, 'platform_admin', true), /data-destination="\/manager\/plattform"/);
assert.match(render(ManagerHomeRoute, 'club_admin', true), /data-destination="\/manager\/saisons"/);
const trainer = render(ManagerMobileNav, 'trainer', true);
for (const path of ['training/einheiten', 'training/bibliothek', 'platzbelegung', 'mehr']) assert.ok(trainer.includes(`href="/manager/${path}"`));
assert.ok(trainer.includes('aria-current="page"'));
assert.ok(!trainer.includes('href="/manager/vereine"'));
const admin = render(ManagerMobileNav, 'platform_admin', true);
assert.ok(admin.includes('href="/manager/vereine"'));
assert.ok(!admin.includes('href="/manager/training/einheiten"'));
delete globalThis.window;
delete globalThis.managerMobileContext;
console.log('PASS: mobile trainer entry, desktop dashboard, admin routes and role-specific navigation');
