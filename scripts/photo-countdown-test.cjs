const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('fs'),vm=require('vm');
const output=ts.transpileModule(fs.readFileSync('src/lib/photoCountdown.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const timers=new Map();let id=0;const context={exports:{},setTimeout(fn){timers.set(++id,fn);return id},clearTimeout(i){timers.delete(i)}};vm.runInNewContext(output,context);
const countdown=context.exports.photoCountdown;
const flush=async()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();await Promise.resolve();await Promise.resolve();};
(async()=>{
 const values=[];let captured=0;const c=new AbortController();const p=countdown(3,c.signal,n=>values.push(n)).then(()=>captured++);
 assert.deepEqual(values,[3]);assert.equal(captured,0);await flush();assert.deepEqual(values,[3,2]);await flush();assert.deepEqual(values,[3,2,1]);assert.equal(captured,0);await flush();await p;assert.equal(captured,1);assert.equal(timers.size,0);
 const cancel=new AbortController();let tookPhoto=false;const q=countdown(5,cancel.signal,()=>{}).then(()=>{tookPhoto=true},()=>{});cancel.abort();await q;assert.equal(tookPhoto,false);assert.equal(timers.size,0);
 const before=new AbortController();before.abort();await assert.rejects(countdown(3,before.signal,()=>assert.fail()));
 await countdown(0,new AbortController().signal,()=>assert.fail());assert.equal(timers.size,0);
 console.log('PASS countdown: 3-2-1, capture only after last second, cancellation clears timer, abort before start, instant shutter');
})();
