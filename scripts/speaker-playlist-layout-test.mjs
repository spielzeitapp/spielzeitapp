import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/manager/components/DjAudioPanel.tsx',import.meta.url),'utf8');
test('playlist selection and enlargement never start playback',()=>{
 const file=ts.createSourceFile('panel.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let checked=0;
 function walk(node){
  if(ts.isJsxAttribute(node)&&['onClick','onDoubleClick'].includes(node.name.getText(file))){
   const text=node.getText(file);
   if(text.includes('setPreset(name)')||text.includes('setPlaylistExpanded')){
    assert.ok(!text.includes('queueTrack')&&!text.includes('toggle('));checked++;
   }
  }
  ts.forEachChild(node,walk);
 }
 walk(file);assert.equal(checked,3);
 assert.ok(source.includes('speaker-playlist-browser'));
 assert.ok(source.includes('speaker-playlist-detail'));
 assert.ok(source.includes('speaker-audio-library'));
 assert.ok(source.indexOf('▶ Playlist starten')<source.indexOf('{ids.map((id,index)=>'));
});
