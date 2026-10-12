const esbuild=require('esbuild');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'match-result-'));const outfile=path.join(dir,'check.cjs');
async function run(){
 await esbuild.build({stdin:{contents:`
 import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MemoryRouter} from 'react-router-dom';
 import {MatchCardLigaportal} from './src/app/components/MatchCardLigaportal';import assert from 'node:assert/strict';
 const card=(status,home,away)=>renderToStaticMarkup(<MemoryRouter><MatchCardLigaportal ourTeamName="SPG Rohrbach" opponent="SPG Böheimkirchen" isHome startsAt="2026-10-17T16:00:00Z" status={status} kind="match" matchType="league" eventType="game" scoreHome={home} scoreAway={away} isPublicView role="fan" scheduleNextMatchHero canManage={false}/></MemoryRouter>);
 const finished=card('finished',1,2);assert(finished.includes('ENDSTAND'));assert(!finished.includes('18:00'));assert.match(finished.replace(/<[^>]*>/g,''),/1\\s*:\\s*2/);
 const live=card('live',0,2);assert(!live.includes('18:00'));assert.match(live.replace(/<[^>]*>/g,''),/0\\s*:\\s*2/);
 const zero=card('finished',0,0);assert.match(zero.replace(/<[^>]*>/g,''),/0\\s*:\\s*0/);
 const unknown=card('finished',null,null);assert(unknown.includes('ENDSTAND'));assert(!unknown.includes('18:00'));assert(unknown.includes('– : –'));
 const upcoming=card('upcoming',null,null);assert(upcoming.includes('18:00'));assert(upcoming.includes('ANPFIFF'));
 console.log('PASS fan hero: finished/live show result instead of kickoff, real 0:0 preserved, unknown result has dashes, upcoming keeps kickoff');
 `,loader:'tsx',resolveDir:process.cwd()},outfile,bundle:true,format:'cjs',platform:'node',logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'no-network',setup(b){b.onLoad({filter:/supabaseClient\.ts$/},()=>({contents:'export const supabase={};',loader:'js'}));}}]});
 require(outfile);fs.rmSync(dir,{recursive:true});
}
run().catch(e=>{console.error(e);process.exitCode=1;});
