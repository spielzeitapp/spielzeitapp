/** Centre crop matching the camera viewport's object-fit: cover. */
export function photoBoothCrop(width:number,height:number,aspect:number) {
 if(width<=0||height<=0||aspect<=0)throw Error('Die Kamera ist noch nicht bereit.');
 const w=Math.min(width,height*aspect),h=w/aspect;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}

export async function photoBoothFile(source:CanvasImageSource,width:number,height:number,aspect:number,mirror=false):Promise<File> {
 const crop=photoBoothCrop(width,height,aspect),canvas=document.createElement('canvas');
 canvas.width=Math.round(1200*aspect);canvas.height=1200;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Bildverarbeitung ist nicht verfügbar.');
 if(mirror){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
 ctx.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Foto konnte nicht erstellt werden.')),'image/jpeg',0.9));
 return new File([blob],'spielerfoto.jpg',{type:'image/jpeg'});
}
