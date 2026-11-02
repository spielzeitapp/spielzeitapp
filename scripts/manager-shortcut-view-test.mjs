import assert from 'node:assert/strict';import{build}from'esbuild';import{createRequire}from'node:module';const require=createRequire(import.meta.url);
const b=await build({entryPoints:['src/manager/canAccessManager.ts'],bundle:true,platform:'node',format:'cjs',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);const{showManagerShortcut:show,canAccessManager:access}=m.exports;
for(const role of ['fan','parent','player',null,undefined]){assert.equal(show(role,'admin',[{role:'trainer'}]),false);assert.equal(show(role,'fan',[]),false);}
for(const role of ['trainer','co_trainer','head_coach','admin']){assert.equal(show(role,'admin',[]),true);assert.equal(show(role,'fan',[{role:'trainer'}]),true);}
assert.equal(show('trainer','fan',[]),false);assert.equal(access('admin',[]),true);assert.equal(access('fan',[{role:'trainer'}]),true);assert.equal(access('fan',[]),false);
console.log('PASS: fan/parent/player view hides shortcut even for staff accounts; staff view requires actual access; profile/Manager eligibility unchanged.');
