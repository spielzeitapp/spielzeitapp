import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/manager/components/DjAudioPanel.tsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/manager/managerSpeakerStudio.css',import.meta.url),'utf8');
test('matchday is default; optional DJ is hidden with CSS, not unmounted',()=>{
 assert.match(source,/useState<'matchday'\|'playlists'\|'library'\|'dj'>\('matchday'\)/);
 assert.match(css,/not\(\[data-music-view="dj"\]\)>\.speaker-decks/);
 assert.match(source,/aria-label="Musikbereiche"/);
 assert.match(source,/if\(quickMode\)setView\('matchday'\)/);
 // None of the three audio elements may live behind a view conditional.
 const file=ts.createSourceFile('panel.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let count=0;
 function walk(node){
  if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(file)==='audio'){
   count++;
   for(let parent=node.parent;parent;parent=parent.parent){
    if(ts.isConditionalExpression(parent)||ts.isBinaryExpression(parent))assert.ok(!parent.getText(file).includes("view==="));
   }
  }
  ts.forEachChild(node,walk);
 }
 walk(file);assert.equal(count,2); // deck element is mapped twice, plus the pad element.
});
test('storage status and cloud saving are visible without opening management details',()=>{
 assert.match(source,/Nur auf diesem Gerät/);assert.match(source,/Im Verein gespeichert/);
 const library=source.slice(source.indexOf('<div className="speaker-playlist speaker-audio-library">'));
 assert.ok(library.indexOf('In Vereinsablage speichern')<library.indexOf('<details className="speaker-track-details">'));
 assert.match(source,/aria-label="Ziel-Playlist"/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
