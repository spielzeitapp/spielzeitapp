export type PortraitEdgeCleanup = 'normal' | 'strong';

/** Trim uncertain segmentation fringes; do not key out white pixels in jerseys. */
export function portraitAlpha(confidence:Float32Array,width:number,height:number,cleanup:PortraitEdgeCleanup='normal'):Uint8ClampedArray {
 if(width<1||height<1||confidence.length!==width*height)throw Error('Ungültige Personenmaske.');
 const strong=cleanup==='strong',low=strong?0.65:0.45,high=strong?0.93:0.82;
 const alpha=new Uint8ClampedArray(confidence.length);
 for(let i=0;i<alpha.length;i++){
  const value=Number.isFinite(confidence[i])?confidence[i]:0;
  const t=Math.max(0,Math.min(1,(value-low)/(high-low)));
  alpha[i]=Math.round(255*t*t*(3-2*t));
 }
 // A small separable minimum filter removes the thin upsampled edge fringe.
 // Radius scales with source resolution and never exceeds three pixels.
 const radius=Math.min(3,Math.max(1,Math.round(Math.max(width,height)/(strong?400:900))));
 const horizontal=new Uint8ClampedArray(alpha.length),out=new Uint8ClampedArray(alpha.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let minimum=255;
  for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<width)minimum=Math.min(minimum,alpha[y*width+x+dx]);
  horizontal[y*width+x]=minimum;
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let minimum=255;
  for(let dy=-radius;dy<=radius;dy++)if(y+dy>=0&&y+dy<height)minimum=Math.min(minimum,horizontal[(y+dy)*width+x]);
  out[y*width+x]=minimum;
 }
 return out;
}
