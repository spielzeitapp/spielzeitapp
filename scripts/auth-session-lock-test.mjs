import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url),dir=mkdtempSync(join(tmpdir(),'auth-lock-'));
try {
 const out=join(dir,'lock.cjs');require('esbuild').buildSync({entryPoints:['src/lib/authSessionLock.ts'],bundle:true,platform:'node',format:'cjs',outfile:out,logLevel:'silent'});
 const {authSessionLock}=require(out);
 let calls=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name,options,callback)=>{assert.equal(options.steal,undefined);return callback({name});}}}});
 assert.equal(await authSessionLock('session',5000,async()=>{calls++;return 42}),42);assert.equal(calls,1);
 const failure=new Error('refresh failed');await assert.rejects(authSessionLock('session',5000,async()=>{calls++;throw failure}),e=>e===failure);assert.equal(calls,2,'callbacks never replay');
 navigator.locks.request=async(name,options,callback)=>{assert.equal(options.ifAvailable,true);return callback(null)};
 await assert.rejects(authSessionLock('session',0,async()=>{calls++}),e=>e.isAcquireTimeout===true);assert.equal(calls,2);
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let abort,clears=0;
 globalThis.setTimeout=fn=>{abort=fn;return 1};globalThis.clearTimeout=()=>{clears++};
 try {
  navigator.locks.request=async(name,options)=>{assert.equal(options.steal,undefined);abort();throw Object.assign(new Error('aborted'),{name:'AbortError'})};
  await assert.rejects(authSessionLock('session',5000,async()=>{calls++}),e=>e.isAcquireTimeout===true);assert.equal(calls,2);assert(clears>0);
 }finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
 console.log('PASS exclusive session lock, no stealing, callback once, error propagation, unavailable lock and acquisition timeout');
}finally{rmSync(dir,{recursive:true,force:true})}
