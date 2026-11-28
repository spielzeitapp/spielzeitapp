import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);process.env.SUPABASE_URL='https://acbaecjzoabafbsjrzvr.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';const manifest=require('../api/exchange/public.js');const club='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a';
async function call(query,method='GET'){const r={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this}};await manifest({query:{manifest:'1',...query},method},r);return r;}
const r=await call({club});assert.equal(r.code,200);assert.equal(r.body.start_url,`/vereinsmarkt/${club}`);assert.equal(r.body.id,`/marktplatz/${club}`);assert.equal(r.body.scope,'/');assert.equal(r.body.short_name,'Vereinsmarkt');assert.ok(!r.body.start_url.startsWith('/app'));assert.equal((await call({club:'invalid'})).code,400);assert.equal((await call({club},'POST')).code,405);
for(const icon of r.body.icons){assert.ok(fs.existsSync('public'+icon.src));const b=fs.readFileSync('public'+icon.src);assert.equal(b.readUInt32BE(16),Number(icon.sizes.split('x')[0]));}
const marketHtml=fs.readFileSync('markt.html','utf8');
assert.match(marketHtml, /href="\/vereinsmarkt\/nsg-goelsental\.webmanifest"/);
assert.match(marketHtml, /rel="apple-touch-icon" href="\/vereinsmarkt\/icon-180\.png"/);
const routing=JSON.parse(fs.readFileSync('vercel.json','utf8'));
assert.ok(routing.redirects.some(item=>item.source==='/marktplatz/:path*'&&item.destination==='/vereinsmarkt/:path*'));
assert.ok(routing.rewrites.some(item=>item.source===`/vereinsmarkt/${club}`&&item.destination==='/markt.html'));
console.log('PASS: club-specific PWA identity, mobile market entry point, alias redirect and icon dimensions');
