export type PortraitPoint={x:number;y:number};
export type PortraitStroke={size:number;points:PortraitPoint[];mode?:'erase'|'restore'|'outline'};

export function portraitPoint(clientX:number,clientY:number,box:{left:number;top:number;width:number;height:number}):PortraitPoint|null {
 if(box.width<=0||box.height<=0)return null;
 const clamp=(v:number)=>Math.max(0,Math.min(1,v));
 return {x:clamp((clientX-box.left)/box.width),y:clamp((clientY-box.top)/box.height)};
}

/** Erase alpha only. The source canvas is never changed. Coordinates survive display zoom. */
export function erasePortraitStroke(ctx:CanvasRenderingContext2D,stroke:PortraitStroke,width:number,height:number):void {
 if(!stroke.points.length)return;
 ctx.save();ctx.globalCompositeOperation='destination-out';
 ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=width*stroke.size/100;
 const [first,...rest]=stroke.points;
 ctx.beginPath();ctx.moveTo(first.x*width,first.y*height);
 for(const p of rest)ctx.lineTo(p.x*width,p.y*height);
 if(!rest.length){ctx.arc(first.x*width,first.y*height,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();
 ctx.restore();
}

/** Restoring must never stretch a separately cropped original into the cutout. */
export function matchingPortraitFrame(cutoutWidth:number,cutoutHeight:number,originalWidth:number,originalHeight:number):boolean {
 if (![cutoutWidth,cutoutHeight,originalWidth,originalHeight].every(n=>Number.isFinite(n)&&n>0))return false;
 const ratio=cutoutWidth/cutoutHeight,originalRatio=originalWidth/originalHeight;
 return Math.abs(ratio-originalRatio)/ratio<=.02;
}

/** Clip a brush-shaped area, then copy genuine pixels from the aligned original.
 * No invented pixels and no edits to the source image. Normalized coordinates
 * keep erase/restore aligned after zoom and rotation. */
export function restorePortraitStroke(ctx:CanvasRenderingContext2D,stroke:PortraitStroke,width:number,height:number,original:HTMLCanvasElement):void {
 if(!stroke.points.length||stroke.size<=0)return;
 const radius=width*stroke.size/200;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.beginPath();
 const disc=(p:PortraitPoint)=>{const x=p.x*width,y=p.y*height;ctx.moveTo(x+radius,y);ctx.arc(x,y,radius,0,Math.PI*2);};
 disc(stroke.points[0]);
 for(let i=1;i<stroke.points.length;i++){
  const a=stroke.points[i-1],b=stroke.points[i];
  const distance=Math.hypot((b.x-a.x)*width,(b.y-a.y)*height);
  const steps=Math.max(1,Math.ceil(distance/Math.max(.5,radius/2)));
  for(let j=1;j<=steps;j++)disc({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});
 }
 ctx.clip();ctx.drawImage(original,0,0,width,height);ctx.restore();
}

/** Reject an incomplete or zero-area outline rather than clearing the portrait. */
export function validPortraitOutline(points:PortraitPoint[]):boolean {
 if(points.length<3||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))return false;
 let twiceArea=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];twiceArea+=a.x*b.y-b.x*a.y;}
 return Math.abs(twiceArea)>.00001;
}

/** Build a manual layer mask directly from genuine original pixels. */
export function outlinePortrait(ctx:CanvasRenderingContext2D,points:PortraitPoint[],width:number,height:number,original:HTMLCanvasElement):void {
 if(!validPortraitOutline(points))return;
 ctx.save();ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='source-over';
 ctx.beginPath();ctx.moveTo(points[0].x*width,points[0].y*height);
 for(const p of points.slice(1))ctx.lineTo(p.x*width,p.y*height);
 ctx.closePath();ctx.clip();ctx.drawImage(original,0,0,width,height);ctx.restore();
}
