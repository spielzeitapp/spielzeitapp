/** Conservative edge-connected white removal; internal white and existing transparency survive. */
export function removeOuterWhiteBackground({ data, width, height }) {
  if (!width || !height || data.length !== width * height * 4) return 0;
  // Already cut out: do not erode white parts that touch a transparent edge.
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return 0;
  const white = i => data[i*4] >= 242 && data[i*4+1] >= 242 && data[i*4+2] >= 242;
  const corners = [0,width-1,(height-1)*width,width*height-1];
  if (corners.filter(white).length < 3) return 0;
  const seen = new Uint8Array(width*height), queue = new Int32Array(width*height); let end=0,start=0;
  const add = i => { if (!seen[i] && white(i)) { seen[i]=1; queue[end++]=i; } };
  for (let x=0;x<width;x++) { add(x);add((height-1)*width+x); }
  for (let y=0;y<height;y++) { add(y*width);add(y*width+width-1); }
  while(start<end) { const i=queue[start++],x=i%width,y=Math.floor(i/width);
    if(x>0)add(i-1);if(x<width-1)add(i+1);if(y>0)add(i-width);if(y<height-1)add(i+width);
  }
  // Ambiguous almost-white images stay intact for manual review.
  if (end > width*height*0.9) return 0;
  for(let n=0;n<end;n++)data[queue[n]*4+3]=0;
  return end;
}

/** Opt-in for dark rectangular logo backdrops; never recolor the crest or its lettering. */
export function removeOuterDarkBackground({data,width,height}) {
 if(width<8||height<8||data.length!==width*height*4)return 0;
 for(let i=3;i<data.length;i+=4)if(data[i]<250)return 0;
 const dark=i=>Math.max(data[i*4],data[i*4+1],data[i*4+2])<=28;
 // Ignore a possible one-pixel export frame, but require a dark, empty rim.
 const inset=2,edge=[];
 for(let x=inset;x<width-inset;x++)edge.push(inset*width+x,(height-1-inset)*width+x);
 for(let y=inset;y<height-inset;y++)edge.push(y*width+inset,y*width+width-1-inset);
 if(edge.some(i=>!dark(i)))return 0;
 const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let start=0,end=0;
 const add=i=>{if(!seen[i]&&dark(i)){seen[i]=1;queue[end++]=i;}};
 for(const i of edge)add(i);
 while(start<end){const i=queue[start++],x=i%width,y=Math.floor(i/width);if(x>0)add(i-1);if(x<width-1)add(i+1);if(y>0)add(i-width);if(y<height-1)add(i+width);}
 if(end>width*height*.98||end<width*height*.1)return 0;
 for(let n=0;n<end;n++)data[queue[n]*4+3]=0;
 // Remove only neutral pixels in the thin outer export frame, outside the verified empty rim.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<inset||y<inset||x>=width-inset||y>=height-inset){const i=(y*width+x)*4;if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])<8)data[i+3]=0;}
 return end;
}
