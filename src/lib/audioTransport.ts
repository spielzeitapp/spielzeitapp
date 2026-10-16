export function clampTempo(value:number){return Number.isFinite(value)?Math.round(Math.max(.8,Math.min(1.2,value))*100)/100:1;}
/** Schedule the envelope on the audio clock, not via repeated JS volume updates.
 * The UI timer only pauses playback AFTER the audio engine has rendered silence. */
export function createScheduledAudioFade(
 gain:Pick<AudioParam,'cancelScheduledValues'|'setValueAtTime'|'linearRampToValueAtTime'>,
 context:{readonly currentTime:number},
 finish:()=>void,
 timers:{schedule:(fn:()=>void,ms:number)=>unknown;cancel:(id:unknown)=>void}={
  schedule:(fn,ms)=>setTimeout(fn,ms),cancel:id=>clearTimeout(id as ReturnType<typeof setTimeout>)
 }
){
 let timer:unknown,version=0;
 function cancel(restoreGain=true){
  version++;if(timer!==undefined)timers.cancel(timer);timer=undefined;
  const now=context.currentTime;gain.cancelScheduledValues(now);gain.setValueAtTime(restoreGain?1:0,now);
 }
 function start(seconds=3){
  cancel();const token=version,now=context.currentTime;
  const duration=Number.isFinite(seconds)?Math.max(.1,seconds):3,end=now+duration;
  gain.setValueAtTime(1,now);gain.linearRampToValueAtTime(0,end);
  const check=()=>{
   if(token!==version)return;
   // Leave a short silent tail so audio output does not cut off the final ramp.
   const remaining=end+.06-context.currentTime;
   if(remaining>0){timer=timers.schedule(check,Math.max(30,Math.min(250,remaining*1000)));return;}
   timer=undefined;finish();
  };
  timer=timers.schedule(check,duration*1000+60);
 }
 return {start,cancel};
}
export type FadeClock = {now:()=>number;schedule:(fn:()=>void,ms:number)=>unknown;cancel:(id:unknown)=>void};
export function createAudioFade(setGain:(value:number)=>void,finish:()=>void,clock:FadeClock={now:()=>performance.now(),schedule:(fn,ms)=>setTimeout(fn,ms),cancel:id=>clearTimeout(id as ReturnType<typeof setTimeout>)} ){
 let timer:unknown,version=0;
 function cancel(){version++;if(timer!==undefined)clock.cancel(timer);timer=undefined;setGain(1);}
 function start(seconds=3){cancel();const token=version,began=clock.now(),duration=Math.max(100,seconds*1000);const tick=()=>{if(token!==version)return;const value=Math.max(0,1-(clock.now()-began)/duration);setGain(value);if(value<=0){timer=undefined;finish();}else timer=clock.schedule(tick,30);};tick();}
 return {start,cancel};
}
