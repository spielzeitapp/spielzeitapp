import {photoBoothCrop} from './playerPhotoBooth';
import {portraitAlpha} from './portraitAlpha';

/** Small on-device preview. The full-resolution photograph is processed separately. */
export function startLivePlayerPortrait(video:HTMLVideoElement,aspect:number,mirror:boolean,onFrame:(url:string)=>void,onError:()=>void):()=>void {
 let active=true,timer:ReturnType<typeof setTimeout>|undefined;
 let segmenter:import('@mediapipe/tasks-vision').ImageSegmenter|undefined;
 void(async()=>{
  try{
   const {FilesetResolver,ImageSegmenter}=await import('@mediapipe/tasks-vision');
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm');
   if(!active)return;
   const model=await ImageSegmenter.createFromOptions(vision,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',delegate:'CPU'},
    runningMode:'IMAGE',outputConfidenceMasks:true,outputCategoryMask:false,
   });
   if(!active){model.close();return;}segmenter=model;
   const canvas=document.createElement('canvas'),matte=document.createElement('canvas');
   canvas.height=480;canvas.width=Math.round(480*aspect);
   const ctx=canvas.getContext('2d'),mctx=matte.getContext('2d');
   if(!ctx||!mctx)throw Error('Canvas unavailable');
   const frame=()=>{
    if(!active)return;
    try{
     if(video.readyState>=2&&video.videoWidth>0){
      const crop=photoBoothCrop(video.videoWidth,video.videoHeight,aspect);
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();
      if(mirror){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
      ctx.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);ctx.restore();
      model.segment(canvas,result=>{
       const mask=result.confidenceMasks?.[0];if(!mask)throw Error('No mask');
       const background=mask.getAsFloat32Array(),foreground=new Float32Array(background.length);
       for(let i=0;i<foreground.length;i++)foreground[i]=1-background[i];
       const alpha=portraitAlpha(foreground,mask.width,mask.height,'gentle');
       matte.width=mask.width;matte.height=mask.height;
       const pixels=mctx.createImageData(mask.width,mask.height);
       for(let i=0;i<alpha.length;i++)pixels.data[4*i+3]=alpha[i];
       mctx.putImageData(pixels,0,0);ctx.globalCompositeOperation='destination-in';
       ctx.drawImage(matte,0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='source-over';
      });
      if(active)onFrame(canvas.toDataURL('image/png'));
     }
     // Keep the preview light enough for mobile devices; never queue inference work.
     if(active)timer=setTimeout(frame,300);
    }catch{if(active){active=false;model.close();segmenter=undefined;onError();}}
   };
   frame();
  }catch{if(active){segmenter?.close();segmenter=undefined;onError();}}
 })();
 return()=>{active=false;if(timer)clearTimeout(timer);segmenter?.close();segmenter=undefined;};
}
