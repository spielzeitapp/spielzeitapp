import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const {webkit}=require('playwright');
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{useViewportRecovery}from'./src/hooks/useViewportRecovery';function Probe(){useViewportRecovery();return null;}createRoot(document.getElementById('probe')).render(React.createElement(Probe));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,plugins:[{name:'scroll-lock-isolation',setup(b){b.onResolve({filter:/bodyScrollLock$/},()=>({path:'locks',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const hasActiveBodyScrollLocks=()=>false;export const forceReleaseBodyScrollLocks=()=>{};'}));}}]});
const cssName=fs.readdirSync('dist/assets').find(x=>/^main-.*\.css$/.test(x));
assert.ok(cssName,'Run the build first');
const css=fs.readFileSync('dist/assets/'+cssName,'utf8');
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
 await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body><div id="root"><div class="app-shell appShell"><div class="app app--internal min-h-screen"><main class="app__content appMain"><div style="height:3000px">Termine<input aria-label="Kommentar"></div></main></div><nav data-app-bottom-nav class="fixed bottom-0 left-0 w-full" style="height:76px">Navigation</nav></div></div><div id="probe"></div></body></html>`);
 await page.evaluate(()=>{
  // iOS launch can disagree: the layout viewport is still 64px shorter.
  Object.defineProperty(window,'innerHeight',{configurable:true,value:810});
  const v=new EventTarget();Object.assign(v,{height:874,offsetTop:0,scale:1});
  Object.defineProperty(window,'visualViewport',{configurable:true,value:v});
 });
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 async function check(height,top=0){
  await page.waitForFunction(({height,top})=>document.documentElement.style.getPropertyValue('--app-visible-height')===height+'px'&&document.documentElement.style.getPropertyValue('--app-visible-top')===top+'px',{height,top});
  const actual=await page.evaluate(()=>({height:document.getElementById('root').getBoundingClientRect().height,top:document.getElementById('root').getBoundingClientRect().top,bottom:document.querySelector('[data-app-bottom-nav]').getBoundingClientRect().bottom}));
  assert.equal(actual.height,height);assert.equal(actual.top,top);assert.equal(actual.bottom,height+top);
 }
 await check(874);console.log('Launch: actual visible height overrides the shorter cached layout viewport.');
 await page.evaluate(()=>{visualViewport.height=760;visualViewport.dispatchEvent(new Event('resize'));});
 await check(760);
 await page.evaluate(()=>{visualViewport.height=874;dispatchEvent(new Event('pageshow'));});
 await check(874);console.log('Viewport resize and app resume move the tabs to the visible bottom.');
 await page.evaluate(()=>{visualViewport.height=810;dispatchEvent(new Event('pageshow'));visualViewport.height=874;});
 await check(874);console.log('Delayed startup measurements settle without a scroll gesture.');
 await page.evaluate(()=>{visualViewport.height=500;visualViewport.offsetTop=90;visualViewport.dispatchEvent(new Event('scroll'));});
 await check(500,90);console.log('Keyboard viewport offset is accounted for.');
 await page.evaluate(()=>{visualViewport.height=874;visualViewport.offsetTop=0;visualViewport.dispatchEvent(new Event('resize'));visualViewport.scale=1.5;visualViewport.height=400;visualViewport.dispatchEvent(new Event('resize'));});
 await check(874);console.log('Pinch zoom does not shrink the app shell.');
 await page.evaluate(()=>{visualViewport.scale=1;visualViewport.height=402;dispatchEvent(new Event('orientationchange'));});
 await page.setViewportSize({width:874,height:402});await check(402);
 await page.evaluate(()=>{scrollTo(0,150);document.querySelector('main').scrollTop=500;});
 const scroll=await page.evaluate(()=>({outer:scrollY,inner:document.querySelector('main').scrollTop}));
 assert.equal(scroll.outer,0);assert.ok(scroll.inner>0);console.log('Rotation preserves bottom anchoring and inner scrolling.');
}finally{await browser.close();}
