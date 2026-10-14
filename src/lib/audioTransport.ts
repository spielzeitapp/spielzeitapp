export function clampTempo(value:number){return Number.isFinite(value)?Math.round(Math.max(.8,Math.min(1.2,value))*100)/100:1;}
export type FadeClock = {now:()=>number;schedule:(fn:()=>void,ms:number)=>unknown;cancel:(id:unknown)=>void};
export function createAudioFade(setGain:(value:number)=>void,finish:()=>void,clock:FadeClock={now:()=>performance.now(),schedule:(fn,ms)=>setTimeout(fn,ms),cancel:id=>clearTimeout(id as ReturnType<typeof setTimeout>)} ){
 let timer:unknown,version=0;
 function cancel(){version++;if(timer!==undefined)clock.cancel(timer);timer=undefined;setGain(1);}
 function start(seconds=3){cancel();const token=version,began=clock.now(),duration=Math.max(100,seconds*1000);const tick=()=>{if(token!==version)return;const value=Math.max(0,1-(clock.now()-began)/duration);setGain(value);if(value<=0){timer=undefined;finish();}else timer=clock.schedule(tick,30);};tick();}
 return {start,cancel};
}
