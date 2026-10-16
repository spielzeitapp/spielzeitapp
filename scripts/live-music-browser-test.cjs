const {webkit}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore',env:{...process.env,VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'test-public-key'}});
(async()=>{for(let i=0;i<30;i++){try{await fetch('http://127.0.0.1:5173/dj-preview.html');break;}catch{await new Promise(r=>setTimeout(r,200));}}const browser=await webkit.launch({headless:true});const page=await browser.newPage({viewport:{width:402,height:874},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});await page.route('https://audio.test/**',route=>route.abort());
await page.goto('http://127.0.0.1:5173/scripts/fixtures/live-music-preview.html');
for(const width of [360,402,768,1024]){await page.setViewportSize({width,height:874});const trigger=page.getByRole('button',{name:'Musikplayer',exact:true});assert.equal(await trigger.evaluate(el=>getComputedStyle(el).position),'static','music control must not float over live actions');if(width===402)await trigger.screenshot({path:'/tmp/music-player-toolbar-button.png'});const box=await trigger.boundingBox();assert.ok(box.y<200 && box.x>=0 && box.x+box.width<=width,'music control stays in top toolbar');}
await page.getByRole('button',{name:'Musikplayer',exact:true}).click();
await page.locator('.speaker-pad--0 .speaker-pad-transport button').first().click();
await page.waitForFunction(()=>document.querySelector('.speaker-pad--0 .speaker-pad-progress')?.textContent.includes('Läuft'));
assert.equal(await page.locator('.speaker-pad--0 .speaker-pad-transport button').count(),1,'one toggle per quick pad');
await page.getByRole('button',{name:'Torhymne stoppen',exact:true}).click();
assert.equal(await page.getByRole('button',{name:'Torhymne starten',exact:true}).isEnabled(),true);
await page.getByRole('button',{name:'Torhymne starten',exact:true}).click();
assert.equal(await page.locator('.speaker-pad--5 .speaker-pad-transport').count(),0,'empty Siegerlied has no dead buttons');
assert.equal(await page.locator('.speaker-pad--5').isVisible(),true);
const playing=await page.evaluate(()=>{const audio=[...document.querySelectorAll('audio')].find(el=>!el.paused);window.playingAudio=audio;return !!audio;});assert.ok(playing);
await page.getByRole('button',{name:'Zum Liveticker',exact:true}).click();
assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
assert.equal(await page.evaluate(()=>window.playingAudio.paused),false,'close must not pause music');
await page.getByRole('button',{name:'Musikplayer',exact:true}).click();
await page.getByRole('button',{name:'Musik verwalten',exact:true}).click();
assert.equal(await page.evaluate(()=>window.playingAudio===document.querySelectorAll('audio')[2]),true,'expanding must retain audio element');
assert.equal(await page.evaluate(()=>window.playingAudio.paused),false,'expanding must retain playback');
assert.equal(await page.locator('.speaker-decks').isVisible(),false,'DJ must be optional, not the default view');
for(const width of [360,402,768,1024]){
 await page.setViewportSize({width,height:874});
 for(const name of ['Playlists','Bibliothek','DJ-Pult','Spieltag']){
  await page.getByRole('navigation',{name:'Musikbereiche'}).getByRole('button',{name,exact:name!=='DJ-Pult'}).click();
  assert.ok(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'organized view overflow: '+name+' '+width);
  assert.equal(await page.evaluate(()=>window.playingAudio.paused),false,'changing views must not pause music');
 }
}
await page.getByRole('navigation',{name:'Musikbereiche'}).getByRole('button',{name:'Playlists',exact:true}).click();
assert.equal(await page.locator('.speaker-playlist-detail').isVisible(),false,'playlist songs stay closed until collection selected');
await page.locator('.speaker-playlist-card').filter({hasText:'Teammusik'}).click();
assert.equal(await page.locator('.speaker-playlist-detail').isVisible(),true);
await page.getByRole('navigation',{name:'Musikbereiche'}).getByRole('button',{name:'Bibliothek',exact:true}).click();
assert.equal(await page.locator('.speaker-audio-library').isVisible(),true);
assert.ok(await page.getByText('Nur auf diesem Gerät',{exact:false}).isVisible());
assert.equal(await page.getByRole('button',{name:'In Vereinsablage speichern',exact:true}).isVisible(),true);
await page.getByRole('button',{name:/^Vereinsablage ·/}).click();
assert.equal(await page.locator('.speaker-cloud-library').isVisible(),true);
assert.equal(await page.locator('.speaker-audio-library').isVisible(),false);
await page.getByRole('button',{name:/^Auf diesem Gerät ·/}).click();
await page.getByRole('navigation',{name:'Musikbereiche'}).getByRole('button',{name:'DJ-Pult',exact:false}).click();
assert.equal(await page.locator('.speaker-decks').isVisible(),true);
await page.screenshot({path:'/tmp/organized-music-dj.png'});
await page.getByRole('button',{name:'Schnelltasten',exact:true}).click();
for(const width of [360,402,768]){await page.setViewportSize({width,height:874});assert.ok(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'dialog overflow at '+width);await page.screenshot({path:'/tmp/live-music-'+width+'.png'});}
assert.equal(await page.getByRole('button',{name:'Musik stoppen',exact:true}).isVisible(),false,'no duplicate stop in quick view');
await page.getByRole('button',{name:'Torhymne stoppen',exact:true}).click();
assert.equal(await page.evaluate(()=>window.playingAudio.paused),true,'pad stop must stop the quick music');
await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
assert.deepEqual(errors,[]);console.log('Live music: quick pads, close/expand preserves audio, STOP, Escape and responsive dialog passed.');
await browser.close();server.kill();})().catch(e=>{server.kill();console.error(e);process.exit(1)});
