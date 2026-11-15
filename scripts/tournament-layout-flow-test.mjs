import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url),dir=mkdtempSync(join(tmpdir(),'t-layout-'));
try {
 const out=join(dir,'view.cjs');
 await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import TestRenderer,{act} from 'react-test-renderer';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {PublicTeamTournamentPage} from './src/pages/public/PublicTeamTournamentPage';
import {TournamentBlockControl} from './src/components/tournament/TournamentBlockControl';
import {groupPublicTournamentMatches} from './src/lib/publicTeamTournament';
import {tournamentBlockReminder} from './src/lib/tournamentBlockReminder';
export {React,TestRenderer,act,MemoryRouter,Routes,Route,PublicTeamTournamentPage,TournamentBlockControl,groupPublicTournamentMatches,tournamentBlockReminder};`},bundle:true,platform:'node',format:'cjs',outfile:out,logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'stubs',setup(b){
 b.onResolve({filter:/tournamentLineupTemplates$|matchLineupVariants$|supabaseClient$/},a=>({path:a.path.split('/').pop(),namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='supabaseClient'?'export const supabase={};':a.path==='tournamentLineupTemplates'?'export const fetchRemoteMatchBlocks=async()=>globalThis.blocks;':'export const readMatchLineupVariants=()=>globalThis.blocks;export const writeMatchLineupVariants=()=>{};'}));
}}]});
 const {React,TestRenderer,act,MemoryRouter,Routes,Route,PublicTeamTournamentPage,TournamentBlockControl,groupPublicTournamentMatches:group,tournamentBlockReminder:reminder}=require(out);
 const matches=[{id:'old',status:'finished',kickoffAt:'2026-11-27T17:14Z'},{id:'next2',status:'upcoming',kickoffAt:'2026-11-27T19:48Z'},{id:'live',status:'live',kickoffAt:'2026-11-27T18:52Z'},{id:'recent',status:'finished',kickoffAt:'2026-11-27T18:10Z'},{id:'next1',status:'upcoming',kickoffAt:'2026-11-27T19:20Z'}];
 const ordered=group(matches);assert.deepEqual(ordered.live.map(m=>m.id),['live']);assert.deepEqual(ordered.upcoming.map(m=>m.id),['next1','next2']);assert.deepEqual(ordered.results.map(m=>m.id),['recent','old']);assert.equal(matches[0].id,'old');
 assert.deepEqual(reminder(359,null,6),{remaining:1,due:false,label:'0:01'});assert.equal(reminder(360,null,6).due,true);assert.equal(reminder(361,360,6).label,'5:59');
 globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.document={visibilityState:'visible'};
 let sounds=0;class Audio {state='running';currentTime=0;destination={};async resume(){}async close(){}createOscillator(){return {frequency:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){sounds++},stop(){}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}
 globalThis.window={AudioContext:Audio};
 const current={GK:'g',LB:'a',RB:'b',CM:'c',LW:'d',RW:'e',ST:null,FP:null},target={...current,LB:'f',RB:'h',CM:'i',LW:'j',RW:'k'};
 const squad=['g','a','b','c','d','e','f','h','i','j','k'];globalThis.blocks={version:1,startVariant:1,lineupMode:'blocks',variants:{1:{slots:current,formationId:'1-2-1-2',squadIds:squad},2:{slots:target,formationId:'1-2-1-2',squadIds:squad}}};
 let applied=0;const props={matchId:'m',seconds:359,running:true,current,squad,name:id=>id,busy:false,onApply:async()=>{applied++;return true},basePath:'/app'};
 const render=p=>React.createElement(MemoryRouter,null,React.createElement(TournamentBlockControl,p));let view;
 await act(async()=>{view=TestRenderer.create(render(props))});
 let toggle=view.root.findByProps({'aria-label':'Signalton einschalten'});await act(async()=>{await toggle.props.onClick()});assert.equal(sounds,1,'gesture enables and tests sound');
 await act(async()=>{view.update(render({...props,seconds:360,running:false}))});assert.equal(sounds,1,'paused clock must not signal');
 await act(async()=>{view.update(render({...props,seconds:360,running:true}))});assert.equal(sounds,2,'due reminder sounds once');
 await act(async()=>{view.update(render({...props,seconds:361,running:true}))});assert.equal(sounds,2,'no repeated siren every clock tick');
 const action=()=>view.root.findAllByType('button').find(b=>String(b.props.children).includes('Block B einsetzen')||b.props.children==='Wechsel bestätigen');
 await act(async()=>{await action().props.onClick()});assert.equal(applied,0,'preview cannot perform substitutions');
 await act(async()=>{await action().props.onClick()});assert.equal(applied,1,'explicit confirmation applies the block');
 await act(async()=>view.unmount());
 await act(async()=>{view=TestRenderer.create(render({...props,current:target,seconds:180}))});
 const early=view.root.findAllByType('button').find(b=>b.props.children==='Block A einsetzen');assert(early&&!early.props.disabled,'actual B lineup must offer A immediately at three minutes');
 const three=view.root.findAllByType('button').find(b=>Array.isArray(b.props.children)&&b.props.children[0]===3);await act(async()=>three.props.onClick());assert(view.root.findByProps({role:'timer'}).children.join('').includes('fällig'),'three-minute preset uses match clock');
 await act(async()=>early.props.onClick());assert.equal(applied,1,'early swap still needs review');
 await act(async()=>view.root.findAllByType('button').find(b=>b.props.children==='Wechsel bestätigen').props.onClick());assert.equal(applied,2,'early swap is allowed before six-minute default');
 await act(async()=>view.unmount());
 globalThis.blocks={...blocks,variants:{1:blocks.variants[1],2:blocks.variants[1]}};
 await act(async()=>{view=TestRenderer.create(render(props))});assert(JSON.stringify(view.toJSON()).includes('A / B identisch'),'identical plans are explained accurately');assert(view.root.findAllByType('button').find(b=>b.props.children==='Block B einsetzen').props.disabled,'identical blocks must not write substitutions');await act(async()=>view.unmount());
 globalThis.window={...window,addEventListener(){},removeEventListener(){},setInterval,clearInterval};document.addEventListener=()=>{};document.removeEventListener=()=>{};
 const page={publicId:'test',tournamentName:'Hallencup',dateLabel:'27. Nov.',teamName:'Rohrbach',ownParticipantName:'Rohrbach',ageGroupLabel:'U12',tournamentStatusLabel:'Läuft',allMatches:matches.map(m=>({...m,ourTeamName:'Rohrbach',opponentName:m.id,kickoffTimeLabel:m.kickoffAt.slice(11,16),scoreOur:m.status==='finished'?1:null,scoreOpp:m.status==='finished'?0:null})),scorers:[],schedule:[],fanRoster:[],upcomingMatches:[],results:[]};
 globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,page})});
 await act(async()=>{view=TestRenderer.create(React.createElement(MemoryRouter,{initialEntries:['/turnier/test']},React.createElement(Routes,null,React.createElement(Route,{path:'/turnier/:publicId',element:React.createElement(PublicTeamTournamentPage)}))))});
 const text=n=>typeof n==='string'?n:(n.children||[]).map(text).join(' ');
 const articles=view.root.findAllByType('article').map(text);
 assert.equal(articles.length,5,'live match must appear once');
 for(const [i,id] of ['live','next1','next2','recent','old'].entries())assert(articles[i].includes(id),'public cards must be ordered '+id);
 assert.equal(view.root.findAllByProps({'aria-label':'Aktuelles Livespiel'}).length,1);
 assert(!view.root.findAllByType('article').some(a=>a.props.className?.includes('tournament-fixture-row')),'pairings must use readable cards');
 await act(async()=>view.unmount());
 page.allMatches=page.allMatches.map(m=>m.status==='live'?{...m,status:'finished',scoreOur:0,scoreOpp:0}:m);
 await act(async()=>{view=TestRenderer.create(React.createElement(MemoryRouter,{initialEntries:['/turnier/test']},React.createElement(Routes,null,React.createElement(Route,{path:'/turnier/:publicId',element:React.createElement(PublicTeamTournamentPage)}))))});
 assert.equal(view.root.findAllByProps({'aria-label':'Nächstes eigenes Spiel'}).length,1,'after finish next own game must become the hero');
 const after=view.root.findAllByType('article').map(text);assert(after[0].includes('next1'));assert.equal(after.filter(t=>t.includes('next1')).length,1,'featured next match is not duplicated');
 const archive=view.root.findAllByType('details').find(d=>d.findAllByType('summary').some(n=>text(n).includes('Weitere Ergebnisse')));assert(archive);assert(!archive.props.open,'older results start collapsed');
 await act(async()=>view.unmount());console.log('PASS live-to-next large hero, no duplicate next fixture, full-size pairing cards and collapsed result archive');console.log('PASS live/upcoming/results order; match-time reminder and reset; optional sound only once, pauses respected; block requires confirmation');
}finally{rmSync(dir,{recursive:true,force:true});}

process.exit(0);
