const assert=require('node:assert/strict');
const handler=require('../api/oefb/schedule.js');
const games=require('./fixtures/rohrbach-km-schedule.json');
let source=games;
global.fetch=async()=>({ok:true,text:async()=>`SG.appPreloads[0]=${JSON.stringify([{type:'SPIELPLAN_MANNSCHAFT',bezeichnung:'Kampfmannschaft',spiele:source}])};`});
async function read(ourTeam='USC Rohrbach'){let code,body;await handler({method:'GET',query:{url:'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/KM/Spiele',ourTeam,includeFriendlies:'1'}},{setHeader(){},status(c){code=c;return this;},json(v){body=v;return this;}});assert.equal(code,200);return body.fixtures;}
(async()=>{
 const fixtures=await read();assert.equal(fixtures.length,35);
 assert.deepEqual(fixtures.slice(0,5).map(f=>[f.opponent,f.is_home]),[['Markersdorf',true],['Pottenbrunn',true],['Ratzersdorf',true],['Karlstetten',true],['Krems ESV',false]]);
 assert.equal(fixtures[5].opponent,'Seitenstetten');
 for(const f of fixtures){const raw=games.find(g=>g.spielUrl.includes(`:s=${f.external_id}`));assert.ok(raw);const home=raw.heimUrl.toLowerCase().includes('/uscrohrbach/');assert.equal(f.is_home,home);assert.equal(f.opponent,home?raw.gastName:raw.heimName);assert.equal(f.opponent_logo_url,'https://vereine.oefb.at'+(home?raw.gastLogo:raw.heimLogo));assert.notEqual(f.opponent,'Rohrbach / Gölsen');if(raw.abgeschlossen){assert.equal(f.score_home,Number(raw.heimTore));assert.equal(f.score_away,Number(raw.gastTore));}}
 assert.deepEqual((await read('Rohrbach / Gölsen')).map(f=>[f.opponent,f.is_home]),fixtures.map(f=>[f.opponent,f.is_home]));
 source=[{...games[0],heimName:'Our Team',gastName:'Opponent',heimUrl:undefined,gastUrl:undefined}];assert.equal((await read('Our Team'))[0].opponent,'Opponent');
 console.log('PASS 35 real Rohrbach fixtures: friendlies and league opponents, venue side, opponent logos, scores, naming aliases and legacy name fallback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
