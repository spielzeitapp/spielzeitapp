import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
async function load(entry, plugins = []) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
    packages: 'external', jsx: 'automatic', plugins, loader: { '.png': 'text', '.svg': 'text' },
    define: { 'import.meta.env.BASE_URL': JSON.stringify('/') },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}

const { isManagerUpcomingEvent } = await load('src/manager/managerUpcomingEvents.ts', [{
  name: 'unused-feed-services',
  setup(build) {
    build.onResolve({ filter: /autoMatchdayFeedEnabled$/ }, () => ({ path: 'feed-service', namespace: 'test-service' }));
    build.onLoad({ filter: /.*/, namespace: 'test-service' }, () => ({
      contents: 'export const isAutoMatchdayFeedEnabledForEvent = () => true;',
    }));
  },
}]);
const now = new Date('2026-10-08T11:45:00Z');
const event = (starts_at, kind = 'tournament', status = 'upcoming') => ({
  id: 'event', starts_at, kind, status, fixture_status: null,
});
assert.equal(isManagerUpcomingEvent(event('2026-08-15T07:00:00Z'), now), false);
assert.equal(isManagerUpcomingEvent(event('2026-08-15T07:00:00Z', 'tournament', 'live'), now), false);
assert.equal(isManagerUpcomingEvent(event('2026-10-08T07:00:00Z'), now), true);
assert.equal(isManagerUpcomingEvent(event('2026-10-16T15:00:00Z', 'match'), now), true);
assert.equal(isManagerUpcomingEvent(event('2026-10-08T15:00:00Z', 'training'), now), true);
assert.equal(isManagerUpcomingEvent(event('2026-10-08T07:00:00Z', 'training'), now), false);
for (const status of ['finished', 'canceled']) {
  assert.equal(isManagerUpcomingEvent(event('2026-10-16T15:00:00Z', 'match', status), now), false);
}
assert.equal(isManagerUpcomingEvent(event('invalid'), now), false);
// Wiener Tageswechsel: gestern bleibt auch bei status=live ausgeschlossen.
assert.equal(isManagerUpcomingEvent(event('2026-10-08T21:30:00Z', 'match', 'live'), new Date('2026-10-08T22:15:00Z')), false);

const { ManagerSidebar } = await load('src/manager/components/ManagerSidebar.tsx', [{
  name: 'sidebar-contexts',
  setup(build) {
    build.onResolve({ filter: /ManagerWorkModeContext$|ManagerClubModulesContext$/ }, args => ({ path: args.path, namespace: 'test-context' }));
    build.onLoad({ filter: /.*/, namespace: 'test-context' }, args => ({
      contents: args.path.endsWith('ManagerWorkModeContext')
        ? 'export const useManagerWorkMode = () => globalThis.managerTestContext;'
        : 'export const useManagerClubModules = () => ({ isModuleEnabled: () => true });',
    }));
  },
}]);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
function render(workMode, supportSession = null) {
  globalThis.managerTestContext = { workMode, supportSession };
  return renderToStaticMarkup(React.createElement(StaticRouter, { location: '/manager/plattform' },
    React.createElement(ManagerSidebar, { open: true, onClose() {} })));
}
const admin = render('platform_admin');
assert.match(admin, /href="\/manager\/plattform"[^>]*>[\s\S]*?Plattform-Dashboard/);
assert.match(admin, /href="\/manager\/vereine"/);
assert.doesNotMatch(admin, /href="\/manager\/training\/einheiten"/);
for (const html of [render('trainer'), render('club_admin'), render('platform_admin', { clubId: 'club' })]) {
  assert.doesNotMatch(html, /href="\/manager\/vereine"/);
  assert.match(html, /href="\/manager\/training\/einheiten"/);
}
delete globalThis.managerTestContext;
console.log('manager-navigation-upcoming-test: OK');
