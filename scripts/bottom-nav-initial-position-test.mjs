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
assert.match(navOpening, /max\(0\.125rem, min\(0\.75rem, calc\(var\(--app-nav-safe-bottom, env\(safe-area-inset-bottom, 0px\)\) - 1\.5rem\)\)\)/);

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
    // Reproduce the complete scroll hierarchy, including an over-height child
    // and a stale root scroll position from the installed app's previous launch.
    for (const viewport of [{ width: 393, height: 852 }, { width: 402, height: 874 }, { width: 744, height: 1133 }]) {
      await page.setViewportSize(viewport);
      await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body><div id="root"><div class="app-shell appShell"><div class="app app--internal min-h-screen"><header class="app-header fixed top-0">Header</header><main class="app__content appMain"><div style="height:3000px">Termine<input aria-label="Kommentar" /></div></main></div>${render('/app/termine')}</div></div></body></html>`);
      await checkBottom('app shell initial paint');
      // Test the visible card edge, not just the transparent nav wrapper.
      // iOS 26 can initially report a toolbar-sized safe area in installed apps.
      for (const inset of [0, 34, 97, 134]) {
        await page.evaluate(inset => document.documentElement.style.setProperty('--app-nav-safe-bottom', inset + 'px'), inset);
        const gap = await page.locator('[data-app-bottom-nav]').evaluate(nav => nav.getBoundingClientRect().bottom - nav.firstElementChild.getBoundingClientRect().bottom);
        assert.ok(gap >= 2 && gap <= 12, `Visible navigation card gap for inset ${inset}: ${gap}`);
      }
      await page.evaluate(() => document.documentElement.style.removeProperty('--app-nav-safe-bottom'));
      const before = await page.locator('[data-app-bottom-nav]').boundingBox();
      await page.evaluate(() => {
        window.scrollTo(0, 150);
        document.querySelector('main.appMain').scrollTop = 600;
      });
      await checkBottom('inner scroll must not move navigation');
      const state = await page.evaluate(() => ({
        documentScroll: scrollY,
        contentScroll: document.querySelector('main.appMain').scrollTop,
        rootHeight: document.getElementById('root').getBoundingClientRect().height,
        viewport: innerHeight,
        position: getComputedStyle(document.querySelector('[data-app-bottom-nav]')).position,
      }));
      const outerStyle = await page.evaluate(() => ({position:getComputedStyle(document.body).position,overflow:getComputedStyle(document.body).overflowY}));
      assert.notEqual(outerStyle.position, 'fixed', 'Do not freeze the outer iOS document');
      assert.notEqual(outerStyle.overflow, 'hidden', 'Preserve the existing viewport adjustment gesture');
      assert.ok(state.contentScroll > 0, 'Appointments must remain scrollable');
      assert.equal(state.position, 'fixed', 'Tabs retain native viewport positioning');
      assert.ok(Math.abs(state.rootHeight - state.viewport) <= 1, JSON.stringify(state));
      const after = await page.locator('[data-app-bottom-nav]').boundingBox();
      assert.equal(before.y, after.y);
      await page.evaluate(() => {const spacer=document.createElement('div');spacer.style.height='150px';document.body.appendChild(spacer);window.scrollTo(0,80);document.body.scrollTop=80;});
      const outerScroll=await page.evaluate(()=>window.scrollY+document.body.scrollTop);
      assert.ok(outerScroll>0, 'Outer page movement must remain available when iOS exposes extra space');
      await checkBottom('viewport navigation after outer adjustment');
      console.log(`WebKit app shell ${viewport.width}x${viewport.height}: fixed tabs, inner scrolling and outer movement passed.`);
    }
    console.log('WebKit: initial load, stale viewport, scroll and landscape checks passed.');
  } finally {
    await browser.close();
  }
}
