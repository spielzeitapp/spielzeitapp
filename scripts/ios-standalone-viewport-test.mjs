import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { webkit } = require('playwright');
const result = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {useViewportRecovery} from './src/hooks/useViewportRecovery'; import {standaloneFullscreenHeight} from './src/lib/standaloneViewport'; window.viewportPolicy = standaloneFullscreenHeight; function Probe(){useViewportRecovery();return null;} createRoot(document.getElementById('probe')).render(React.createElement(Probe));`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, plugins: [{ name: 'scroll-lock-isolation', setup(b) { b.onResolve({filter:/bodyScrollLock$/},()=>({path:'locks',namespace:'mock'})); b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const hasActiveBodyScrollLocks=()=>false;export const forceReleaseBodyScrollLocks=()=>{};'})); } }] });
const cssName = fs.readdirSync('dist/assets').find(name => /^main-.*\.css$/.test(name));
assert.ok(cssName, 'Run npm run build first');
const css = fs.readFileSync(`dist/assets/${cssName}`, 'utf8');
const browser = await webkit.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: {width:402,height:874}, isMobile:true, hasTouch:true });
  await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body><div id="root"><div class="app-shell appShell"><div class="app app--internal min-h-screen"><main class="app__content appMain"><div style="height:3000px">Feed<input aria-label="Kommentar"></div></main></div><nav data-app-bottom-nav class="fixed bottom-0 left-0 w-full" style="height:99px">Navigation</nav></div></div><div id="probe"></div></body></html>`);
  await page.evaluate(() => {
    Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
    Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15'});
    Object.defineProperty(screen,'width',{configurable:true,value:402});
    Object.defineProperty(screen,'height',{configurable:true,value:874});
    Object.defineProperty(window,'innerHeight',{configurable:true,value:812});
    const vv = new EventTarget(); Object.assign(vv,{height:812,width:402,offsetTop:0,scale:1});
    Object.defineProperty(window,'visualViewport',{configurable:true,value:vv});
  });
  await page.addScriptTag({content:result.outputFiles[0].text});
  await page.waitForFunction(()=>document.documentElement.dataset.iosStandaloneFullscreen==='true');
  const initial = await page.evaluate(() => ({height:document.getElementById('root').getBoundingClientRect().height,bottom:document.querySelector('[data-app-bottom-nav]').getBoundingClientRect().bottom,position:getComputedStyle(document.querySelector('[data-app-bottom-nav]')).position}));
  assert.deepEqual(initial,{height:874,bottom:874,position:'absolute'});
  console.log('PASS: screenshot case 402×812 on 402×874 screen anchors the nav to 874 immediately, without scrolling.');
  await page.evaluate(()=>{Object.defineProperty(window,'innerHeight',{configurable:true,value:874});visualViewport.height=874;visualViewport.dispatchEvent(new Event('resize'));});
  assert.equal(await page.locator('[data-app-bottom-nav]').evaluate(el=>el.getBoundingClientRect().bottom),874);
  await page.evaluate(()=>{document.querySelector('main').scrollTop=700;});
  assert.equal(await page.evaluate(()=>scrollY),0);
  assert.ok(await page.locator('main').evaluate(el=>el.scrollTop)>0);
  console.log('PASS: native viewport recovery and feed scrolling keep the bar at the same position.');
  await page.getByRole('textbox').focus();
  await page.evaluate(()=>{visualViewport.height=500;visualViewport.offsetTop=20;visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ios-standalone-fullscreen')&&document.documentElement.style.getPropertyValue('--app-visible-height')==='500px');
  assert.equal(await page.locator('[data-app-bottom-nav]').evaluate(el=>getComputedStyle(el).position),'fixed');
  console.log('PASS: focused input/keyboard keeps the real visual viewport.');
  await page.evaluate(()=>{document.activeElement.blur();visualViewport.height=812;visualViewport.offsetTop=0;Object.defineProperty(window,'innerHeight',{configurable:true,value:812});dispatchEvent(new Event('pageshow'));});
  await page.waitForFunction(()=>document.documentElement.dataset.iosStandaloneFullscreen==='true');
  assert.equal(await page.locator('[data-app-bottom-nav]').evaluate(el=>el.getBoundingClientRect().bottom),874);
  const results = await page.evaluate(()=>{
    const base={ios:true,standalone:true,screenWidth:402,screenHeight:874,innerWidth:402,innerHeight:812,visibleHeight:812,visibleTop:0,scale:1,editing:false};
    return [window.viewportPolicy(base),window.viewportPolicy({...base,standalone:false}),window.viewportPolicy({...base,ios:false}),window.viewportPolicy({...base,editing:true}),window.viewportPolicy({...base,scale:1.5}),window.viewportPolicy({...base,visibleHeight:450}),window.viewportPolicy({...base,innerWidth:700}),window.viewportPolicy({...base,screenHeight:NaN})];
  });
  assert.deepEqual(results,[874,null,null,null,null,null,null,null]);
  console.log('PASS: resume recovery; Safari, Android, keyboard, zoom, split-screen/rotation and invalid dimensions are excluded.');
} finally { await browser.close(); }
