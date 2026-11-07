import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{act,create}=require('react-test-renderer');
const bundle=await build({stdin:{contents:`import React from 'react';import {MemoryRouter} from 'react-router-dom';import {SessionViewProvider} from './src/auth/useSession';import {MatchCardLigaportal} from './src/app/components/MatchCardLigaportal';export const Fixture=({open})=><SessionViewProvider value={{user:null,effectiveRole:'fan'}}><MemoryRouter><MatchCardLigaportal ourTeamName="Home" opponent="Away" startsAt="2026-11-07T13:00:00Z" status="finished" scoreHome={4} scoreAway={1} isHome role="fan" isPublicView onPublicDetails={open} scheduleNextMatchHero canManage={false}/></MemoryRouter></SessionViewProvider>`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',define:{'import.meta.env':'{}'},plugins:[{name:'no-network',setup(b){b.onLoad({filter:/supabaseClient\.ts$/},()=>({contents:'export const supabase={};',loader:'js'}));}}]});
const m={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,m,m.exports);
let tree,opened=0;
const report=()=>tree.root.findAll(n=>n.type==='div'&&n.children.some(c=>typeof c==='object'&&c.type==='span'&&c.children.includes('BERICHT')))[0];
try{
await act(async()=>tree=create(React.createElement(m.exports.Fixture,{open:()=>opened++})));
assert.equal(report().props.role,'button');assert.equal(report().props.tabIndex,0);
await act(async()=>report().props.onClick({stopPropagation(){}}));assert.equal(opened,1);
await act(async()=>report().props.onKeyDown({key:'Enter',preventDefault(){},stopPropagation(){}}));assert.equal(opened,2);
assert.equal(tree.root.findAllByProps({'aria-label':'Bearbeiten'}).length,0);
await act(async()=>tree.update(React.createElement(m.exports.Fixture,{})));
assert.equal(report().props.role,undefined,'No source means no false report action');
assert.equal(report().props.onClick,undefined,'Public preview remains non-interactive without explicit action');
console.log('PASS league report: click and keyboard open explicit read-only details; missing source stays noninteractive.');
}finally{await act(async()=>tree?.unmount());}
