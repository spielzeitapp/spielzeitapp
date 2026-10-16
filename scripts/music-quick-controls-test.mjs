import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/manager/components/DjAudioPanel.tsx',import.meta.url),'utf8');
const dock=fs.readFileSync(new URL('../src/components/live/LiveMusicDock.tsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/components/live/liveMusicDock.css',import.meta.url),'utf8');
test('quick pads toggle start and stop; unused pads have no disabled transport',()=>{
 assert.ok(source.includes("quickMode&&active?stopPad():playPad(i)"));
 assert.ok(source.includes('disabled={!track||(!quickMode&&active)}'));
 assert.ok(source.includes('!quickMode||track?<div className="speaker-pad-transport">'));
 assert.ok(source.includes('!quickMode?<button type="button" className="speaker-pad-stop"'));
 assert.ok(source.includes("quickMode?'Musik stoppen':'ALLES STOPP'"));
});
test('Siegerlied replaces old defaults without replacing custom pad names or file IDs',()=>{
 assert.ok(source.includes("custom==='Outro'||custom==='Feiermusik'"));
 assert.ok(source.includes("?'Siegerlied':custom||name"));
 assert.ok(source.includes("const id=pads[i],track=tracks.find(t=>t.id===id)"));
});
test('quick window has one close action and keeps audio mounted',()=>{
 assert.ok(!dock.includes('<X'));
 assert.equal((dock.match(/onClick={close}/g)||[]).length,1);
 assert.ok(dock.includes('Musik läuft beim Zurückgehen weiter.'));
 assert.ok(dock.includes("'Musik verwalten'"));
 assert.ok(dock.includes('quickMode={!fullPlayer}'));
 assert.ok(css.includes('>.speaker-master-actions{display:none!important}'));
 assert.ok(css.includes('speaker-pad--playing{background:#133226;border:1px solid #22c55e'));
 assert.ok(css.includes('button:first-child{background:#bd142b;border-color:#bd142b}'));
});
