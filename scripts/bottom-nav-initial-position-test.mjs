import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.NODE_ENV ??= 'production';
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const router = require('react-router-dom');
const source = fs.readFileSync('src/app/components/BottomNav.tsx', 'utf8');
const navStart = source.indexOf('<nav', source.indexOf('export const BottomNav'));
const navOpening = source.slice(navStart, source.indexOf('aria-label=', navStart));
assert.match(navOpening, /fixed bottom-0/);
assert.doesNotMatch(navOpening, /\bbottom\s*:/, 'No JS bottom override: first paint must be browser-anchored');
assert.doesNotMatch(source, /readVisualViewportBottomOffset|visualViewportBottomOffset/);
assert.equal((navOpening.match(/safe-area-inset-bottom/g) ?? []).length, 1);
assert.match(navOpening, /max\(0\.125rem, calc\(env\(safe-area-inset-bottom, 0px\) - 1\.5rem\)\)/);

const mocks = {
  '../../auth/AuthProvider': { useAuth: () => ({ user: null }) },
  '../../auth/useSession': { useSession: () => ({ effectiveRole: 'trainer' }) },
  '../../lib/roles': { normalizeRole: value => value },
  '../../hooks/useAppHasLiveMatch': { useAppHasLiveMatch: () => false, useAppLiveMatchState: () => ({ liveMatchId: null }) },
  '../../hooks/useUnreadCount': { useUnreadCount: () => 0 },
  './CompetitionContext': { useCompetition: () => ({ settings: null }) },
  '../../demo/DemoContext': { useDemoMode: () => null },
};
const context = {
  exports: {}, require: path => mocks[path] ?? require(path),
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(source.replaceAll('import.meta.env.BASE_URL', "'/'"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, context);

const render = route => renderToStaticMarkup(React.createElement(router.MemoryRouter, { initialEntries: [route] }, React.createElement(context.exports.BottomNav)));
for (const route of ['/app/home', '/app/termine', '/demo/termine']) {
  const html = render(route);
  assert.match(html, /data-app-bottom-nav/);
  assert.doesNotMatch(html, /style="(?:[^";]*;)*bottom:/);
  for (const label of ['Home', 'Termine', 'Team', 'Live', 'Mehr']) assert.ok(html.includes(label), label);
}
console.log('Bottom navigation first-paint/component assertions passed for App and Demo.');

if (process.argv.includes('--browser')) {
  const { webkit } = require('playwright');
  const browser = await webkit.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    const cssFile = fs.readdirSync('dist/assets').find(file => /^main-.*\.css$/.test(file));
    assert.ok(cssFile, 'Run npm run build before browser checks');
    const css = fs.readFileSync(`dist/assets/${cssFile}`, 'utf8');
    await page.route('**/*', route => route.abort());
    await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body><main style="height:2500px">Training</main>${render('/app/termine')}</body></html>`);
    const checkBottom = async label => {
      const state = await page.locator('[data-app-bottom-nav]').evaluate(nav => ({ bottom: nav.getBoundingClientRect().bottom, viewport: window.innerHeight, cssBottom: getComputedStyle(nav).bottom }));
      assert.equal(state.cssBottom, '0px', label);
      assert.ok(Math.abs(state.bottom - state.viewport) <= 1, `${label}: ${JSON.stringify(state)}`);
    };
    await checkBottom('initial load before scrolling');
    await page.evaluate(() => {
      // Simulate stale iOS startup/resume values: these must never lift the bar.
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: innerHeight - 64, offsetTop: 0, scale: 1 } });
      dispatchEvent(new Event('pageshow'));
      dispatchEvent(new Event('resize'));
    });
    await checkBottom('stale visual viewport');
    await page.evaluate(() => scrollTo(0, 400));
    await checkBottom('after scrolling');
    await page.setViewportSize({ width: 852, height: 393 });
    await checkBottom('landscape resize');
    console.log('WebKit: initial load, stale viewport, scroll and landscape checks passed.');
  } finally {
    await browser.close();
  }
}
