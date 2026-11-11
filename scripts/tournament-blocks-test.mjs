import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);const {buildSync}=require('esbuild');
const tmp=mkdtempSync(join(tmpdir(),'blocks-test-'));
try {
 const load=(path)=>{const out=join(tmp,path.split('/').pop()+'.cjs');buildSync({entryPoints:[path],bundle:true,platform:'node',format:'cjs',outfile:out,logLevel:'silent',define:{'import.meta.env':JSON.stringify({DEV:false,VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_ANON_KEY:'synthetic-test-key'})}});return require(out)};
 const {planBlockChange}=load('src/lib/tournamentBlocks.ts');const engine=load('src/lib/matchEngine.ts');const f=load('src/lib/matchFormations.ts');
 const current={GK:'g',LB:'a',RB:'b',CM:null,LW:'c',RW:'d',ST:null,FP:null};const target={...current,LB:'e',RB:'f',LW:'h',RW:'i'};const squad=['g','a','b','c','d','e','f','h','i'];
 assert.equal(planBlockChange(current,target,squad,true).changes.length,4);
 assert.equal(planBlockChange({...current,LB:'e'},target,squad,true).changes.length,3);
 assert.equal(planBlockChange(current,current,squad,false).changes.length,0);
 assert.throws(()=>planBlockChange(current,{...target,LB:'missing'},squad,true));
 assert.throws(()=>planBlockChange(current,{...target,LB:'f'},squad,true));
 assert.equal(planBlockChange({...current,CM:'j'},{...target,CM:'k'},[...squad,'j','k'],true).changes.length,5);
 for(const id of ['1-2-2','1-2-1-2']){assert(f.auditFormationSlotLayout(id).valid);assert.equal(f.resolveLivePitchFormationId(id,false),id);}
 const kickoff=['g','a','b','','c','d',''];const saved=['g','e','f','','h','i',''];const events=planBlockChange(current,target,squad,true).changes.map((c,i)=>({id:'s'+i,type:'substitution',timestamp:360,playerId:c.outId,swapWithPlayerId:c.inId}));
 const replay=engine.deriveLiveMatchReplayState({kickoffLineup:kickoff,squadPlayerIds:squad,events,finalSecond:600,fallbackStartingPlayerIds:saved});assert.deepEqual(new Set(replay.onFieldPlayerIds),new Set(saved.filter(Boolean)));
 const times=engine.computePlayerPlaytimeFromEvents({kickoffStartingPlayerIds:kickoff,squadPlayerIds:squad,events,finalMatchSecond:600});assert.equal(times.g,600);for(const id of ['a','b','c','d'])assert.equal(times[id],360);for(const id of ['e','f','h','i'])assert.equal(times[id],240);
 const {computeTournamentPreparationChecks,resolveTournamentPrimaryAction}=load('src/lib/tournamentPreparationFlow.ts');const input={hasOfficialPlanUrl:false,participantCount:0,slots:[],attendance:{playerCount:12,yesCount:4,noCount:1,openCount:7},lineupReady:false,tournamentSquadCount:0};assert.equal(computeTournamentPreparationChecks(input)[0].id,'availability');assert.equal(resolveTournamentPrimaryAction(input).kind,'check_attendance');assert.equal(resolveTournamentPrimaryAction({...input,attendance:{...input.attendance,openCount:0}}).kind,'set_squad');
 console.log('PASS tournament preparation priority, 4+1/5+1 blocks, individual overrides, validation, live replay and playtime');
}finally{rmSync(tmp,{recursive:true,force:true})}
