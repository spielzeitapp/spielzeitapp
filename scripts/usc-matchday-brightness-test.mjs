import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const b=await build({entryPoints:['src/components/feed/LiveMatchdayPosterArtwork.tsx','src/components/team/PlayerPortraitCanvas.tsx','src/lib/playerPhotoLayout.ts'],outdir:'out',bundle:true,format:'cjs',platform:'node',packages:'external',write:false,define:{'import.meta.env.BASE_URL':'"/"'},loader:{'.css':'empty'}});
const mods=b.outputFiles.map(f=>{const m={exports:{}};new Function('require','module','exports',f.text)(require,m,m.exports);return m.exports;});
const {LiveMatchdayPosterArtwork:Poster}=mods[0],{PlayerPortraitCanvas:Portrait}=mods[1],{portraitBrightness,DEFAULT_PHOTO_LAYOUT}=mods[2];
for(const [value,expected]of [[undefined,100],[NaN,100],[20,50],[200,150],[120,120]])assert.equal(portraitBrightness(value),expected);
const props={statusLabel:'Spieltag',title:'SPIELTAG',homeTeamName:'KM USC Rohrbach',awayTeamName:'ASK Wilhelmsburg',homeLogoUrl:'/logos/usc.png',awayLogoUrl:'/logos/ask.png',kickoffTime:'13:00',matchDate:'So. 24.01.2027',location:'Sportplatz',isHomeGame:true,competitionLabel:'KM · Testspiel',playerBrightness:120};
for(const photo of [null,'/player.png']){
 const html=renderToStaticMarkup(React.createElement(Poster,{...props,playerImageUrl:photo}));
 assert.match(html,/usc-matchday-poster/);assert.match(html,/#GEMEINSAMSTARK/);assert.doesNotMatch(html,/KM USC Rohrbach/);assert.match(html,/13:00/);
 if(photo){assert.match(html,/brightness\(120%\)/);assert.match(html,/player.png/);}else assert.doesNotMatch(html,/matchday-poster-player/);
}
const other=renderToStaticMarkup(React.createElement(Poster,{...props,homeTeamName:'U12 SPG Rohrbach',awayTeamName:'SC Melk',playerImageUrl:'/youth.png'}));assert.doesNotMatch(other,/usc-matchday-poster/);assert.match(other,/#GEMEINSAM/);assert.doesNotMatch(other,/#GEMEINSAMSTARK/);
const portrait=renderToStaticMarkup(React.createElement(Portrait,{layout:{...DEFAULT_PHOTO_LAYOUT,brightness:125},photoUrl:'/portrait.png',firstName:'Max',lastName:'Spieler',number:30}));
assert.match(portrait,/<img[^>]+brightness\(125%\)/);assert.doesNotMatch(portrait,/<div[^>]+style="[^"]*brightness/);
console.log('PASS USC matchday with/without player, youth unchanged, saved photo brightness only on image, neutral defaults and bounds.');
