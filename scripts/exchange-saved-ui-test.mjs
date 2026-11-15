import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'saved-test-'));
globalThis.__savedDb={rows:[],fail:false};
const mock=`const db=globalThis.__savedDb;export const supabase={from(){let filters=[],op='read',value;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},delete(){op='delete';return q},upsert(v){op='save';value=v;return q},then(fn){if(db.fail)return Promise.resolve({error:{message:'failure'}}).then(fn);if(op==='save'&&!db.rows.some(r=>r.user_id===value.user_id&&r.listing_id===value.listing_id))db.rows.push(value);if(op==='delete')db.rows=db.rows.filter(r=>!filters.every(f=>f(r)));return Promise.resolve({data:db.rows.filter(r=>filters.every(f=>f(r))),error:null}).then(fn)}};return q}};`;
const out=await build({entryPoints:['src/features/club/useSavedListings.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'mock',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:mock,loader:'js'}));}}]});
const Module=require('module'),file=path.join(scratch,'hook.cjs'),m=new Module(file);m.filename=file;m.paths=require.resolve.paths('react');m._compile(out.outputFiles[0].text,file);
let hook;function Probe({user}){hook=m.exports.useSavedListings(user);return React.createElement('div',null,hook.ids.join(','));}
let app;await act(async()=>{app=create(React.createElement(Probe,{user:'a'}))});
await act(async()=>hook.toggle('listing'));assert.deepEqual(hook.ids,['listing']);assert.equal(__savedDb.rows.length,1);
await act(async()=>app.unmount());await act(async()=>{app=create(React.createElement(Probe,{user:'a'}))});assert.ok(hook.saved.has('listing'),'saved after remount/new device read');
await act(async()=>app.update(React.createElement(Probe,{user:'b'})));assert.equal(hook.ids.length,0);
__savedDb.fail=true;await act(async()=>hook.toggle('other'));assert.ok(hook.error);assert.equal(hook.ids.length,0);
__savedDb.fail=false;await act(async()=>app.update(React.createElement(Probe,{user:'a'})));await act(async()=>hook.toggle('listing'));assert.equal(__savedDb.rows.length,0);assert.equal(hook.ids.length,0);
await act(async()=>app.update(React.createElement(Probe,{user:undefined})));assert.equal(hook.ids.length,0);await act(async()=>app.unmount());await fs.rm(scratch,{recursive:true,force:true});console.log('PASS: save, persisted reload, user switch isolation, error without false success, removal, logout');
