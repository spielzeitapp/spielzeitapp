import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
test('music mode uses one stable audio panel and hides only the speaker layout',()=>{
 const file=new URL('../src/manager/ManagerSpeakerStudioPage.tsx',import.meta.url);const source=fs.readFileSync(file,'utf8');const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let count=0,conditional=false;
 function visit(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==='DjAudioPanel'){count++;for(let p=node.parent;p;p=p.parent)if(ts.isConditionalExpression(p))conditional=true;}ts.forEachChild(node,visit);}visit(tree);
 assert.equal(count,1);assert.equal(conditional,false);assert.ok(source.includes("onClick={()=>setMode('music')}"));assert.ok(source.includes('♫ Musikmodus'));assert.ok(source.includes('speaker-studio--music'));
 const css=fs.readFileSync(new URL('../src/manager/managerSpeakerStudio.css',import.meta.url),'utf8');assert.ok(css.includes('.speaker-studio--music .speaker-run'));assert.ok(css.includes('.speaker-studio--music .speaker-reading'));assert.ok(css.includes('.speaker-studio--music .speaker-workspace{display:block}'));
});
