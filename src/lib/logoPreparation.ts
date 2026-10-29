import { removeOuterWhiteBackground } from '../../lib/logoBackground.mjs';

/** Only the exact official ÖFB PNG format reaches the fixed-host image endpoint. */
export function displayLogoUrl(raw: string): string {
 const id=/^https:\/\/(?:www\.)?oefb\.at\/oefb2\/images\/1278650591628556536_([a-f0-9]{20})-1,0-120x120-120x120\.png$/i.exec(raw.trim())?.[1];
 return id ? `/api/oefb/table?view=logo&id=${id.toLowerCase()}` : raw;
}
export async function prepareLogoFile(file: File): Promise<{ file: File; changed: boolean }> {
 const url=URL.createObjectURL(file);
 try {
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Bild konnte nicht gelesen werden.'));img.src=url;});
  if(image.width*image.height>16000000)throw Error('Logo ist zu groß. Bitte ein kleineres Bild verwenden.');
  const canvas=document.createElement('canvas');const ratio=Math.min(1,1024/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Logo-Vorschau nicht verfügbar.');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  let changed=removeOuterWhiteBackground(pixels)>0;
  // Trim only transparent margins; preserve enclosed white parts of the crest.
  let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels.data[(y*canvas.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  ctx.putImageData(pixels,0,0);
  if(right>=left && bottom>=top && (left>0 || top>0 || right<canvas.width-1 || bottom<canvas.height-1)){
    const cropped=ctx.getImageData(left,top,right-left+1,bottom-top+1);
    canvas.width=cropped.width;canvas.height=cropped.height;ctx.putImageData(cropped,0,0);changed=true;
  }
  if(!changed)return {file,changed:false};
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG konnte nicht erstellt werden.')),'image/png'));
  return {file:new File([blob],file.name.replace(/\.[^.]+$/,'')+'.png',{type:'image/png'}),changed:true};
 }finally{URL.revokeObjectURL(url);}
}
