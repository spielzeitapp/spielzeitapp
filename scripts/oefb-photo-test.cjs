const assert=require('node:assert/strict');const handler=require('../api/_lib/oefbPhoto');
const original=global.fetch;let calls=0,options;
async function request(url){const res={headers:{},statusCode:0,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},end(){return this;},send(b){this.body=b;return this;}};await handler({method:'GET',query:{url}},res);return res;}
(async()=>{try{
 global.fetch=async(u,o)=>{calls++;options=o;return new Response(Uint8Array.from([255,216,255,0]),{headers:{'Content-Type':'image/jpeg;charset=utf-8'}});};
 for(const u of ['http://vereine.oefb.at/netzwerk/imagedownload/test.jpg','https://example.com/test.jpg','https://vereine.oefb.at:444/netzwerk/imagedownload/test.jpg','https://vereine.oefb.at/netzwerk/imagedownload/test.svg','https://vereine.oefb.at/netzwerk/imagedownload/test.jpg?url=x','https://user@vereine.oefb.at/netzwerk/imagedownload/test.jpg'])assert.equal((await request(u)).statusCode,400);
 assert.equal(calls,0);
 const result=await request('https://vereine.oefb.at/netzwerk/imagedownload/test.jpg');assert.equal(result.statusCode,200);assert.equal(result.headers['Content-Type'],'image/jpeg');assert.equal(options.redirect,'error');assert.equal(result.body[0],255);
 global.fetch=async()=>new Response('<html>error</html>',{headers:{'Content-Type':'image/jpeg'}});
 assert.equal((await request('https://vereine.oefb.at/netzwerk/imagedownload/test.jpg')).statusCode,502);
 console.log('PASS: fixed host/path, no credentials/ports/queries/SVG, no redirects, byte validation and image delivery.');
}finally{global.fetch=original;}})().catch(e=>{console.error(e);process.exitCode=1});
