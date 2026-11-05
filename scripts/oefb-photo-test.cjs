const assert=require('node:assert/strict');const handler=require('../server/lib/oefbPhoto');
const original=global.fetch;let calls=0,options;
async function request(url,quality){const res={headers:{},statusCode:0,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},end(){return this;},send(b){this.body=b;return this;}};await handler({method:'GET',query:{url,quality}},res);return res;}
(async()=>{try{
 global.fetch=async(u,o)=>{calls++;options=o;return new Response(Uint8Array.from([255,216,255,0]),{headers:{'Content-Type':'image/jpeg;charset=utf-8'}});};
 for(const u of ['http://vereine.oefb.at/netzwerk/imagedownload/test.jpg','https://example.com/test.jpg','https://vereine.oefb.at:444/netzwerk/imagedownload/test.jpg','https://vereine.oefb.at/netzwerk/imagedownload/test.svg','https://vereine.oefb.at/netzwerk/imagedownload/test.jpg?url=x','https://user@vereine.oefb.at/netzwerk/imagedownload/test.jpg'])assert.equal((await request(u)).statusCode,400);
 assert.equal(calls,0);
 const result=await request('https://vereine.oefb.at/netzwerk/imagedownload/test.jpg');assert.equal(result.statusCode,200);assert.equal(result.headers['Content-Type'],'image/jpeg');assert.ok(result.headers['Vercel-CDN-Cache-Control'].includes('s-maxage=86400'));assert.ok(result.headers['CDN-Cache-Control'].includes('stale-while-revalidate')); assert.equal(options.redirect,'error');assert.equal(result.body[0],255);
 global.fetch=async()=>new Response('<html>error</html>',{headers:{'Content-Type':'image/jpeg'}});
 assert.equal((await request('https://vereine.oefb.at/netzwerk/imagedownload/test.jpg')).statusCode,502);
 const small='https://vereine.oefb.at/netzwerk/imagedownload/synthetic-80-80-token.jpeg';
 const seen=[];
 global.fetch=async(u)=>{seen.push(u);if(u.includes('-400-400-'))return new Response('missing',{status:404});return new Response(Uint8Array.from([255,216,255,0]),{headers:{'Content-Type':'image/jpeg'}});};
 assert.equal((await request(small,'portrait')).statusCode,200);assert.deepEqual(seen,[small.replace('-80-80-','-400-400-'),small]);
 seen.length=0;global.fetch=async(u)=>{seen.push(u);return new Response(Uint8Array.from([255,216,255,0]),{headers:{'Content-Type':'image/jpeg'}});};
 assert.equal((await request(small,'portrait')).statusCode,200);assert.equal(seen.length,1);assert.ok(seen[0].includes('-400-400-'));
 console.log('PASS: fixed host/path, no credentials/ports/queries/SVG, no redirects, byte validation and image delivery.');
}finally{global.fetch=original;}})().catch(e=>{console.error(e);process.exitCode=1});
