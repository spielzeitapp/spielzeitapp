/** Rotate pixels for upright editing, then invert before saving to retain source coordinates. */
export function rotatePortraitCanvas(source:HTMLCanvasElement,rotation:number=0):HTMLCanvasElement {
 const angle=((rotation%360)+360)%360;
 if(!angle)return source;
 if(![90,180,270].includes(angle))throw Error('Ungültige Bilddrehung.');
 const output=document.createElement('canvas');
 output.width=angle===180?source.width:source.height;
 output.height=angle===180?source.height:source.width;
 const ctx=output.getContext('2d');if(!ctx)throw Error('Bildbearbeitung ist nicht verfügbar.');
 ctx.save();
 ctx.translate(output.width/2,output.height/2);ctx.rotate(angle*Math.PI/180);
 ctx.drawImage(source,-source.width/2,-source.height/2);
 ctx.restore();
 return output;
}
