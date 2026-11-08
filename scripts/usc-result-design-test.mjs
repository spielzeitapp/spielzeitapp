import assert from 'node:assert/strict';
import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const b=await build({entryPoints:['src/components/feed/ResultPosterArtwork.tsx','src/lib/resultFeedTypes.ts'],outdir:'out',bundle:true,format:'cjs',platform:'node',packages:'external',write:false,define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},loader:{'.css':'empty'},plugins:[{name:'brand',setup(b){b.onResolve({filter:/useMatchClubBranding$/},()=>({path:'brand',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const useMatchClubBranding=()=>({brand:{logo_url:'https://example.test/usc-original.png'},style:{}});`}));}}]});
const mods=b.outputFiles.map(f=>{const m={exports:{}};new Function('require','module','exports',f.text)(require,m,m.exports);return m.exports;});
const Artwork=mods[0].ResultPosterArtwork,caption=mods[1].buildAutoResultCaption;
const common={ageGroup:null,seasonLabel:'KM · 2026/27',competition:'Meisterschaft',date:'Sa. 31.10.2026',venue:'Sportplatz Rohrbach',periods:null,scorers:[]};
for(const isHome of [true,false])for(const [home,away,state]of [[0,3,isHome?'loss':'win'],[3,0,isHome?'win':'loss'],[0,0,'draw'],[12,10,isHome?'win':'loss']]){
 const p={team_season_id:'usc',our_team_name:'KM USC Rohrbach',is_home:isHome,home_score:home,away_score:away,home_team_name:isHome?'KM USC Rohrbach':'ASK Loosdorf',away_team_name:isHome?'ASK Loosdorf':'KM USC Rohrbach',home_logo_url:'https://example.test/home.png',away_logo_url:'https://example.test/away.png'};
 const html=renderToStaticMarkup(React.createElement(Artwork,{...common,payload:p}));
 assert.match(html,/result-poster--usc/);assert.match(html,/#GEMEINSAMSTARK/);assert.doesNotMatch(html,/#GEMEINSAMEINTEAM|KM USC/);
 assert.match(html,/SPIELERGEBNIS/);assert.match(html,/Fr\.|Sa\./);assert.match(html,/usc-original.png/);assert.match(html,new RegExp(`data-result-state="${state}"`));
 assert.match(html,new RegExp(`${home}:${away}`));assert.doesNotMatch(html,/UNSERE TORSCHÜTZEN/);
 const text=caption({ourTeamName:p.our_team_name,opponentName:'ASK Loosdorf',homeScore:home,awayScore:away,resultState:state,isHome});
 assert.match(text,/#GEMEINSAMSTARK/);assert.doesNotMatch(text,/KM USC|wir lernen/);
 assert.match(text,new RegExp(`${isHome?home:away}:${isHome?away:home}`));
 assert.match(caption({ourTeamName:p.our_team_name,opponentName:'ASK Loosdorf',homeScore:home,awayScore:away,resultState:state,isHome,legacyTemplate:true}),/#GEMEINSAMEINTEAM/);
}
const youth={our_team_name:'U12 SPG Rohrbach',home_team_name:'U12 SPG Rohrbach',away_team_name:'SC Melk',home_score:2,away_score:1,is_home:true};
const html=renderToStaticMarkup(React.createElement(Artwork,{...common,ageGroup:'U12',payload:youth}));assert.doesNotMatch(html,/result-poster--usc/);assert.match(html,/#GEMEINSAM<span>EINTEAM/);
console.log('PASS real artwork: USC home/away win/draw/loss, multi-digit score, original branding, separate KM/season, hashtag, captions, legacy recognition and youth design retained.');
