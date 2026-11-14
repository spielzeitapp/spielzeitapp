import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'training-run-')), require=createRequire(import.meta.url);
try {
 buildSync({entryPoints:['src/lib/trainingRun.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'run.cjs')});
 const h=require(join(dir,'run.cjs')), start=Date.parse('2026-11-14T17:00:00Z');
 const initial=h.createTrainingRun([{id:'1',title:'Passen',seconds:900},{id:'2',title:'Match',seconds:1200},{id:'3',title:'Abschluss',seconds:600}],start);
 let run=h.changeRunPhase(initial,'active',start+120000);assert.equal(run.explanation,120);assert.equal(run.exercises[0].active,0);
 run=h.changeRunPhase(run,'break',start+420000);assert.equal(run.exercises[0].active,300);
 const clone=JSON.parse(JSON.stringify(run));run=h.changeRunPhase(clone,'explain',start+480000);assert.equal(run.breaks,60);assert.equal(run.exercises[0].active,300);
 run=h.nextRunExercise(run,start+510000);assert.equal(run.index,1);assert.equal(run.exercises[0].done,true);assert.equal(run.explanation,150);assert.equal(initial.exercises[0].active,0);
 run=h.changeRunPhase(run,'break',start+520000);run.phase='match';run.matchBaseline=100;
 const resumed=h.importRunMatch(run,400,start+940000);assert.equal(resumed.exercises[1].active,300);assert.equal(resumed.breaks,180);assert.equal(resumed.phase,'explain');assert.equal(h.importRunMatch(resumed,400,start+950000),resumed,'no double import');
 const timing=h.runTiming(resumed,start+2000000,start+1000000);assert.equal(timing.active,600);assert.equal(timing.total,1000);assert.equal(timing.current.explanation,220);
 const fit=h.shortenRun(resumed,start+2200000,start+1000000);assert.deepEqual(fit.exercises.slice(0,2),resumed.exercises.slice(0,2));assert(fit.exercises[2].seconds<=300);assert(h.runTiming(fit,start+2200000,start+1000000).end<=start+2200000);
 assert.throws(()=>h.shortenRun(resumed,start+1100000,start+1000000),/1 Minute/);
 const finished=h.changeRunPhase(resumed,'finished',start+1000000);assert.equal(h.runTiming(finished,start+2200000,start+9000000).total,1000);assert.throws(()=>h.changeRunPhase(finished,'active',start+1001000));
 const final=h.nextRunExercise(h.nextRunExercise(resumed,start+1000000),start+1001000);assert.equal(final.phase,'finished');assert(final.exercises.every(e=>e.done));
 console.log('PASS: explanation vs active vs break, reload continuity, match import without double count, immutable played exercises, delay fitting and completion.');
} finally {rmSync(dir,{recursive:true,force:true});}
