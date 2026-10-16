import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateBpm, syncTempo, bpmFromTaps } from '../src/lib/audioBpm.ts';
function beat(bpm,seconds=35,rate=11025){
 const samples=new Float32Array(seconds*rate);
 for(let i=0;i<samples.length;i++){const phase=(i/rate)%(60/bpm);samples[i]=phase<.04?Math.sin(2*Math.PI*90*i/rate)*Math.exp(-phase*90):0;}
 return samples;
}
for(const bpm of [80,100,120,131.3,160])test('detects '+bpm+' BPM from an audible pulse',()=>{assert.ok(Math.abs(estimateBpm(beat(bpm),11025)-bpm)<1,'expected '+bpm);});
test('silence and short jingles have no invented BPM',()=>{assert.equal(estimateBpm(new Float32Array(11025*10),11025),null);assert.equal(estimateBpm(beat(120,3),11025),null);});
test('sync matches actual other-deck BPM precisely, including its tempo change',()=>{const rate=syncTempo(122,131.3);assert.ok(Math.abs(rate*122-131.3)<.001);assert.equal(syncTempo(100,140),null);assert.equal(syncTempo(0,120),null);assert.equal(syncTempo(100,80),.8);assert.equal(syncTempo(100,120),1.2);});
test('tap requires four stable taps and ignores a late or invalid sequence',()=>{assert.equal(bpmFromTaps([0,500,1000]),null);assert.equal(bpmFromTaps([0,500,1000,1500]),120);assert.equal(bpmFromTaps([0,500,1000,4000]),null);assert.equal(bpmFromTaps([0,0,0,0]),null);});

test('a sustained tone is not assigned a rhythmic BPM',()=>{const samples=new Float32Array(11025*20);for(let i=0;i<samples.length;i++)samples[i]=.2*Math.sin(2*Math.PI*440*i/11025);assert.equal(estimateBpm(samples,11025),null);});
