import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createScheduledAudioFade} from '../src/lib/audioTransport.ts';
function fixture(){
 let audioTime=10,id=0,finished=0;const pending=new Map(),events=[];
 const param={
  cancelScheduledValues(time){events.push(['cancel',time]);},
  setValueAtTime(value,time){events.push(['set',value,time]);},
  linearRampToValueAtTime(value,time){events.push(['ramp',value,time]);}
 };
 const fade=createScheduledAudioFade(param,{get currentTime(){return audioTime;}},()=>finished++,{
  schedule(fn,ms){pending.set(++id,{fn,ms});return id;},cancel(key){pending.delete(key);}
 });
 return {fade,events,pending,done:()=>finished,tick(time){audioTime=time;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(({fn})=>fn());}};
}
test('gain ramp is scheduled once on audio clock for the full three seconds',()=>{
 const f=fixture();f.fade.start(3);
 assert.deepEqual(f.events.at(-1),['ramp',0,13]);
 const before=f.events.length;f.tick(11.5);
 assert.equal(f.events.length,before,'JS callbacks must not rewrite volume during the ramp');
 assert.equal(f.done(),0);f.tick(13);assert.equal(f.done(),0,'keep a short silent tail');
 f.tick(13.07);assert.equal(f.done(),1);f.tick(20);assert.equal(f.done(),1);
});
test('suspended audio clock must not be stopped by a delayed wall-clock timer',()=>{
 const f=fixture();f.fade.start(3);f.tick(10);f.tick(10);
 assert.equal(f.done(),0);assert.equal(f.pending.size,1);f.tick(13.1);assert.equal(f.done(),1);
});
test('cancel removes automation and stale finish callbacks cannot stop new music',()=>{
 const f=fixture();f.fade.start(3);const stale=[...f.pending.values()][0].fn;
 f.tick(11);f.fade.cancel();assert.deepEqual(f.events.slice(-2),[['cancel',11],['set',1,11]]);
 stale();f.tick(20);assert.equal(f.done(),0);assert.equal(f.pending.size,0);
});
test('replacement fade ignores old timer and schedules its own deadline',()=>{
 const f=fixture();f.fade.start(3);const stale=[...f.pending.values()][0].fn;
 f.tick(11);f.fade.start(3);stale();assert.deepEqual(f.events.at(-1),['ramp',0,14]);
 f.tick(13.1);assert.equal(f.done(),0);f.tick(14.1);assert.equal(f.done(),1);
});
test('component keeps master muted after automatic fade completion',()=>{
 const s=fs.readFileSync(new URL('../src/manager/components/DjAudioPanel.tsx',import.meta.url),'utf8');
 assert.ok(s.includes('createScheduledAudioFade(master.current.gain,ctx.current,()=>stopPlayback(false))'));
 const stop=s.slice(s.indexOf('function stopPlayback('),s.indexOf('useEffect(()=>{alive.current'));
 assert.ok(stop.indexOf('pause()')<stop.indexOf('cancelFade(restoreGain)'));
 assert.ok(s.includes('fadeToken!==fadeVersion.current'));
 assert.ok(s.includes("ctx.current.state!=='running'"));
});
test('completed fade stays muted until explicit restart restores gain',()=>{
 const f=fixture();f.fade.start(3);f.tick(13.1);assert.equal(f.done(),1);
 f.fade.cancel(false);assert.deepEqual(f.events.at(-1),['set',0,13.1]);
 const after=f.events.length;f.tick(30);assert.equal(f.events.length,after,'must never reset volume on its own');
 f.fade.cancel();assert.deepEqual(f.events.at(-1),['set',1,30]);
});
