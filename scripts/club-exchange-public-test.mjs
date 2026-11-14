import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const club='10000000-0000-0000-0000-000000000001',id='50000000-0000-0000-0000-000000000001';
const rows=[{id,club_id:club,is_public:true,public_confirmed_at:'2026-11-14',title:'Pulli',size:'140',status:'Verfügbar',owner_id:'secret-user',owner_label:'Secret',team_label:'U12',photo_paths:[`${club}/secret-user/${id}/x.jpg`]}, {id:'private',club_id:club,is_public:false,status:'Verfügbar',photo_paths:[]},{id:'gone',club_id:club,is_public:true,public_confirmed_at:'yes',status:'Vergeben',photo_paths:[]}];
let downloads=0;
const db={from(table){let list=table==='clubs'?[{id:club,name:'Testverein',status:'active'}]:rows;const q={select(){return q},eq(k,v){list=list.filter(r=>r[k]===v);return q},not(k){list=list.filter(r=>r[k]!=null);return q},in(k,vs){list=list.filter(r=>vs.includes(r[k]));return q},order(){return q},limit(){return q},maybeSingle(){return Promise.resolve({data:list[0]||null})},then(fn){return Promise.resolve({data:list}).then(fn)}};return q},storage:{from(){return {async download(){downloads++;return {data:new Blob(['image'])}}}}}};
const module={exports:{}};const env={SUPABASE_URL:'https://acbaecjzoabafbsjrzvr.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic'};
vm.runInNewContext(fs.readFileSync('api/exchange/public.js','utf8'),{require:()=>({createClient:()=>db}),module,process:{env},Buffer});
async function call(query,method='GET'){const res={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this},send(v){this.body=v;return this}};await module.exports({query,method},res);return res;}
let r=await call({club});assert.equal(r.code,200);assert.equal(r.body.items.length,1);const payload=JSON.stringify(r.body);for(const s of ['secret-user','owner_label','team_label','photo_paths','public_confirmed_at'])assert.ok(!payload.includes(s),s);assert.ok(r.body.items[0].photos[0].includes(`listing=${id}`));assert.equal(r.headers['Cache-Control'],'no-store');
r=await call({club,listing:id,photo:'0'});assert.equal(r.code,200);assert.equal(downloads,1);
rows[0].is_public=false;r=await call({club,listing:id,photo:'0'});assert.equal(r.code,404);assert.equal(downloads,1);
assert.equal((await call({club:'bad'})).code,400);assert.equal((await call({club},'POST')).code,405);
env.SUPABASE_URL='https://live.supabase.co';assert.equal((await call({club})).code,403);
console.log('PASS: public opt-in/status filters, safe projection, authorized photos, revocation, invalid input, method, TEST guard');
