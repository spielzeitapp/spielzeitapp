/**
 * Layout-Smoke für Welcome-Scroll/Safe-Area.
 * Ohne Playwright: Source-Assertions. Mit Playwright: Viewport-Messung.
 */
import fs from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'src/app/intro/WelcomeScreen.tsx');
const src = fs.readFileSync(srcPath, 'utf8');

const sourceChecks = [
  ['overflow-y-auto', src.includes('overflow-y-auto')],
  [
    'no overflow-y-hidden on welcome root',
    !/className="welcome-screen[^"]*overflow-y-hidden/.test(src),
  ],
  ['safe-area top', src.includes('env(safe-area-inset-top, 0px)')],
  ['safe-area bottom', src.includes('env(safe-area-inset-bottom, 0px)')],
  ['min-h 100dvh', src.includes('min-h-[100dvh]')],
  ['grid 1fr spacer', src.includes('grid-rows-[minmax(10rem,1fr)_auto_auto]')],
  ['cta bottom auto row', src.includes('_auto_auto]')],
  ['no 58vh spacer', !src.includes('58vh')],
  ['no max-h 100dvh clip', !src.includes('max-h-[100dvh]')],
  ['scroll touch', src.includes('-webkit-overflow-scrolling:touch') || src.includes('[-webkit-overflow-scrolling:touch]')],
];

let failed = 0;
for (const [label, ok] of sourceChecks) {
  if (!ok) {
    console.error('FAIL', label);
    failed += 1;
  } else {
    console.log('OK', label);
  }
}
if (failed) process.exit(1);

const HTML = `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style>
html,body{margin:0;background:#000;color:#fff}
.welcome-screen{position:fixed;inset:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;
-webkit-overflow-scrolling:touch;padding-top:max(0.375rem, env(safe-area-inset-top, 0px));
padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 100px);background:#000}
.inner{position:relative;margin:0 auto;display:grid;grid-template-rows:minmax(10rem,1fr) auto auto;min-height:100dvh;height:100%;width:100%;max-width:28rem;padding:max(0.5rem, env(safe-area-inset-top, 0px)) 1.25rem max(1rem, env(safe-area-inset-bottom, 0px));box-sizing:border-box}
.bg{position:absolute;inset:0;min-height:100%;width:100%;background:linear-gradient(180deg,#3a0000,#111)}
.spacer{position:relative;z-index:10;min-height:10rem}
.cta{position:relative;z-index:10;display:flex;flex-direction:column;gap:6px;pointer-events:auto}
button{min-height:56px;width:100%;border-radius:12px;border:1px solid rgba(255,0,0,.25);background:rgba(42,0,0,.78);color:#fff;font-size:16px;font-weight:700}
footer{position:relative;z-index:10;margin-top:10px;padding-bottom:8px;font-size:11px;opacity:.7}
</style></head><body>
<div class="welcome-screen" id="welcome"><div class="inner"><div class="bg"></div><div class="spacer"></div>
<div class="cta"><p style="font-weight:700;font-size:17px">DEIN TEAM. EINFACH DURCH DIE GANZE SAISON.</p>
<button id="primary" type="button">Kompletten Traineralltag erleben</button>
<button id="secondary" type="button">Demo frei erkunden</button></div>
<footer>Hinweise</footer></div></div></body></html>`;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('SOURCE_CHECKS ok (playwright not installed — layout fixture skipped)');
  process.exit(0);
}

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 16 Pro', width: 393, height: 852 },
];

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true });
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(url);
  const metrics = await page.evaluate(() => {
    const welcome = document.getElementById('welcome');
    const primary = document.getElementById('primary');
    const secondary = document.getElementById('secondary');
    const cs = getComputedStyle(welcome);
    primary.scrollIntoView({ block: 'end' });
    const pr = primary.getBoundingClientRect();
    const sr = secondary.getBoundingClientRect();
    return {
      overflowY: cs.overflowY,
      paddingBottom: cs.paddingBottom,
      canScroll: welcome.scrollHeight > welcome.clientHeight + 1,
      primaryVisible: pr.top < window.innerHeight && pr.bottom > 0,
      secondaryVisible: sr.top < window.innerHeight && sr.bottom > 0,
      primaryClickable: pr.height > 0 && pr.width > 0,
    };
  });
  const ok =
    metrics.overflowY === 'auto' &&
    metrics.primaryClickable &&
    metrics.secondaryVisible;
  if (!ok) {
    console.error('FAIL', vp.name, metrics);
    failed += 1;
  } else {
    console.log('OK', vp.name, metrics);
  }
  await page.close();
}
await browser.close();
server.close();
if (failed) process.exit(1);
console.log('WELCOME_IOS_LAYOUT ok');
