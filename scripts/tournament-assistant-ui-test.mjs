import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const tmp=mkdtempSync(join(tmpdir(),'tournament-assistant-ui-'));
try {
  const file=join(tmp,'assistant-ui.cjs');
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';
    import {MemoryRouter} from 'react-router-dom';
    import TestRenderer, {act} from 'react-test-renderer';
    import assert from 'node:assert/strict';
    import {TournamentAssistantCard} from './src/components/tournament/TournamentAssistantCard';
    const calls=[];
    const props={tournamentEventId:'test',slots:[],attendance:{playerCount:2,yesCount:1,noCount:0,openCount:1},hasOfficialPlanUrl:false,ownMatchCount:1,templateReady:true,
      onOpenAttendance:()=>calls.push('attendance'),onOpenSquad:()=>calls.push('squad'),onImportPlan:()=>calls.push('plan'),onOpenLineup:()=>calls.push('lineup'),
      onAddMatch:()=>{},onCreateReport:()=>{},onCompleteTournament:()=>{},onViewStatus:()=>{}};
    let view;
    const render=p=><MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><TournamentAssistantCard {...p}/></MemoryRouter>;
    await act(async()=>{view=TestRenderer.create(render(props));});
    let progress=view.root.findByProps({role:'progressbar'});
    assert.equal(progress.props['aria-valuemax'],4);
    assert.equal(progress.props['aria-valuenow'],3);
    for (const [index,label] of ['Verfügbarkeit klären','Turnierkader wählen','Turnierplan hinterlegen','Aufstellung & Blöcke'].entries()) {
      const button=view.root.findAllByType('button').find(b=>b.props['aria-label']?.startsWith((index+1)+'. '+label));
      assert(button, label+' must be a button');
      act(()=>button.props.onClick());
    }
    assert.deepEqual(calls,['attendance','squad','plan','lineup']);
    assert(!JSON.stringify(view.toJSON()).includes('Feed & Kommunikation'));
    assert(!JSON.stringify(view.toJSON()).includes('Alle 7 Schritte'));
    assert(!JSON.stringify(view.toJSON()).includes('✓ Turnier vorbereitet'));
    await act(async()=>view.update(render({...props,attendance:{playerCount:2,yesCount:2,noCount:0,openCount:0}})));
    progress=view.root.findByProps({role:'progressbar'});
    assert.equal(progress.props['aria-valuenow'],4);
    assert.equal(progress.findAllByType('span').filter(s=>s.props.className.includes('bg-emerald-400')).length,4);
    assert(JSON.stringify(view.toJSON()).includes('✓ Turnier vorbereitet'));
    await act(async()=>view.update(render({...props,attendance:{playerCount:2,yesCount:2,noCount:0,openCount:0},ownMatchCount:0})));
    assert.equal(view.root.findByProps({role:'progressbar'}).props['aria-valuenow'],3);
    assert(!JSON.stringify(view.toJSON()).includes('✓ Turnier vorbereitet'));
    act(()=>view.unmount());
    console.log('PASS: all preparation rows invoke their editor, communication is outside preparation, four progress bars turn green only with complete data, missing plan stays open.');
  `},bundle:true,platform:'node',format:'esm',outfile:file.replace('.cjs','.mjs'),logLevel:'silent',packages:'external',define:{'import.meta.env':JSON.stringify({DEV:false})},plugins:[{name:'controlled-data',setup(b){
    const stubs={
      'liveMatchService':`export const LIVE_FIELD_SLOT_ORDER=['GK','LB','RB','CM','LW','RW','ST','FP'];export const upsertMatchForSetup=async()=>({});export const updateMatchRow=async()=>({});export const fetchMatchById=async()=>({data:null});export const fetchLineupForLiveMatch=async()=>({data:{startingPlayerIds:[]}});`,
      'tournamentSquad':`export const fetchTournamentSquadPlayerIds=async()=>({data:['a','b'],error:null});`,
      'tournamentLineupCopy':`export const detectTournamentLineupCopyContext=async()=>null;export const copyTournamentLineupBetweenMatches=async()=>({error:null});`,
      'supabaseClient':`export const supabase={};`,
      'demoPaths':`export const useInternalBasePath=()=>'/demo';`
    };
    b.onResolve({filter:/\/(liveMatchService|tournamentSquad|tournamentLineupCopy|supabaseClient|demoPaths)$/},args=>({path:args.path.split('/').pop(),namespace:'controlled'}));
    b.onLoad({filter:/.*/,namespace:'controlled'},args=>({contents:stubs[args.path]}));
  }}]});
  // Resolve React and renderer from this repository when executing the temporary bundle.
  const {spawnSync}=require('node:child_process');
  const localFile=join(process.cwd(),'node_modules','.tournament-assistant-ui-test.mjs');
  const {copyFileSync,unlinkSync}=require('node:fs');
  copyFileSync(file.replace('.cjs','.mjs'),localFile);
  try {const result=spawnSync(process.execPath,[localFile],{stdio:'inherit'});assert.equal(result.status,0);} finally {unlinkSync(localFile);}
} finally {rmSync(tmp,{recursive:true,force:true});}
