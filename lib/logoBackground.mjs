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
